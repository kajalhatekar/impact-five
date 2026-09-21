import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type CharitySelection = {
  charity_id: string | null;
  charity_name: string | null;
  charity_percentage: number | null;
};

type Score = {
  id: string;
  score: number;
  played_on: string;
  created_at: string;
};

type Subscription = {
  subscription_id: string;
  plan_id: string;
  plan_code: string | null;
  plan_name: string | null;
  price_paise: number | null;
  currency: string | null;
  billing_interval: string | null;
  subscription_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  razorpay_subscription_id: string | null;
};

type Winner = {
  prize_paise: number;
  verification_status: string;
  payout_status: string;
};

function formatPrice(pricePaise: number | null, currency: string | null) {
  if (pricePaise === null) {
    return "₹0";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency ?? "INR",
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
}

function formatDate(date: string | null) {
  if (!date) {
    return null;
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

type RequirementRowProps = {
  label: string;
  complete: boolean;
  completeText?: string;
  incompleteText?: string;
};

function RequirementRow({
  label,
  complete,
  completeText = "Complete",
  incompleteText = "Required",
}: RequirementRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4">
      <span className="text-sm text-slate-600">{label}</span>

      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          complete
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        {complete ? completeText : incompleteText}
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [charityResult, scoresResult, subscriptionResult, winningsResult] =
    await Promise.all([
      supabase.rpc("get_my_charity_selection"),
      supabase.rpc("get_my_scores"),
      supabase.rpc("get_my_subscription"),
      supabase
        .from("draw_winners")
        .select("prize_paise, verification_status, payout_status")
        .eq("user_id", user.id)
        .neq("verification_status", "rejected"),
    ]);

  /*
   * The RPC functions return arrays because they use RETURNS TABLE.
   * The first record is the current user's selection/subscription.
   */
  const charityRows = (charityResult.data as CharitySelection[] | null) ?? [];

  const scoreRows = (scoresResult.data as Score[] | null) ?? [];

  const subscriptionRows =
    (subscriptionResult.data as Subscription[] | null) ?? [];

  const winnerRows = (winningsResult.data as Winner[] | null) ?? [];

  const totalWinningsPaise = winnerRows.reduce(
    (total, winner) => total + winner.prize_paise,
    0,
  );

  const totalWinnings = formatPrice(totalWinningsPaise, "INR");

  const winnerCount = winnerRows.length;

  const charitySelection = charityRows[0] ?? null;
  const subscription = subscriptionRows[0] ?? null;
  const scores = scoreRows;

  /*
   * Safe charity values.
   * JSX below never accesses charitySelection directly.
   */
  const selectedCharityId = charitySelection?.charity_id ?? null;

  const selectedCharityName =
    charitySelection?.charity_name ?? "No charity selected";

  const selectedCharityPercentage = charitySelection?.charity_percentage ?? 0;

  const hasCharitySelection = selectedCharityId !== null;

  /*
   * Score status.
   */
  const scoreCount = scores.length;
  const hasFiveScores = scoreCount >= 5;
  const remainingScoreCount = Math.max(0, 5 - scoreCount);

  /*
   * Safe subscription values.
   */
  const subscriptionStatus = subscription?.subscription_status ?? "inactive";

  const isSubscriptionActive = ["active", "trialing"].includes(
    subscriptionStatus,
  );

  const subscriptionPlanName = subscription?.plan_name ?? "Membership";

  const subscriptionPlanCode = subscription?.plan_code ?? null;

  const subscriptionPrice = formatPrice(
    subscription?.price_paise ?? null,
    subscription?.currency ?? "INR",
  );

  const billingInterval =
    subscription?.billing_interval === "year" ? "year" : "month";

  const renewalDate = formatDate(subscription?.current_period_end ?? null);

  const cancelAtPeriodEnd = subscription?.cancel_at_period_end ?? false;

  const isDemoSubscription =
    subscription?.razorpay_subscription_id?.startsWith("demo_") ?? false;

  /*
   * A user is eligible only when all three requirements are complete.
   */
  const isDrawEligible =
    hasFiveScores && hasCharitySelection && isSubscriptionActive;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  const firstName =
    fullName.trim().split(" ")[0] || user.email?.split("@")[0] || "there";

  const loadError =
    charityResult.error?.message ??
    scoresResult.error?.message ??
    subscriptionResult.error?.message ??
    winningsResult.error?.message ??
    null;

  return (
    <main className="min-h-screen bg-[#f4f1e9] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Your impact
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Welcome, {firstName}
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Track your scores, manage your charity contribution and follow your
            monthly prize-draw participation.
          </p>
        </section>

        {loadError && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            {loadError}
          </div>
        )}

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Subscription card */}
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-xl">
              ◷
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Subscription
            </p>

            <p className="mt-1 text-xl font-bold text-slate-950">
              {isSubscriptionActive ? subscriptionPlanName : "Not active"}
            </p>

            {isSubscriptionActive ? (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {subscriptionPrice}/{billingInterval}
                  {renewalDate ? ` · Renews ${renewalDate}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Active
                  </span>

                  {isDemoSubscription && (
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      Demo mode
                    </span>
                  )}

                  {cancelAtPeriodEnd && (
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      Cancels at period end
                    </span>
                  )}
                </div>

                <Link
                  href="/subscribe"
                  className="mt-5 inline-flex text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
                >
                  Manage membership →
                </Link>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Choose a monthly or yearly plan to participate in draws.
                </p>

                <Link
                  href="/subscribe"
                  className="mt-5 inline-flex rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                >
                  Choose a plan
                </Link>
              </>
            )}
          </article>

          {/* Scores card */}
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl">
              ✓
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Latest scores
            </p>

            <p className="mt-1 text-xl font-bold text-slate-950">
              {Math.min(scoreCount, 5)} of 5
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {hasFiveScores
                ? "Your latest five Stableford scores are recorded."
                : `Add ${remainingScoreCount} more ${
                    remainingScoreCount === 1 ? "score" : "scores"
                  } to complete your latest five.`}
            </p>

            <Link
              href="/dashboard/scores"
              className="mt-5 inline-flex text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
            >
              Manage scores →
            </Link>
          </article>

          {/* Charity card */}
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-100 text-xl">
              ♥
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Charity contribution
            </p>

            {hasCharitySelection ? (
              <>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  {selectedCharityPercentage}%
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Supporting {selectedCharityName}.
                </p>

                <Link
                  href="/charities"
                  className="mt-5 inline-flex text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
                >
                  Update contribution →
                </Link>
              </>
            ) : (
              <>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  Not selected
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Choose a charity and direct at least 10% of your subscription.
                </p>

                <Link
                  href="/charities"
                  className="mt-5 inline-flex text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
                >
                  Choose a charity →
                </Link>
              </>
            )}
          </article>

          {/* Winnings card */}
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-xl">
              ◇
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Total winnings
            </p>

            <p className="mt-1 text-xl font-bold text-slate-950">
              {totalWinnings}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {winnerCount > 0
                ? `${winnerCount} ${
                    winnerCount === 1 ? "prize" : "prizes"
                  } recorded. View your draw results for verification and payment status.`
                : "Your winnings and payment status will appear here."}
            </p>

            {winnerCount > 0 ? (
              <Link
                href="/draws"
                className="mt-5 inline-flex text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
              >
                View draw results →
              </Link>
            ) : (
              <span className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                No winnings yet
              </span>
            )}
          </article>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Selected charity */}
          <article className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-sm">
            <div className="p-7 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                Your chosen cause
              </p>

              {hasCharitySelection ? (
                <>
                  <h2 className="mt-4 text-3xl font-bold">
                    {selectedCharityName}
                  </h2>

                  <p className="mt-4 max-w-xl leading-7 text-emerald-100">
                    You have chosen to direct{" "}
                    <strong className="text-white">
                      {selectedCharityPercentage}%
                    </strong>{" "}
                    of your subscription contribution towards this charity.
                  </p>

                  <div className="mt-7">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>Contribution percentage</span>

                      <span className="font-bold">
                        {selectedCharityPercentage}%
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-emerald-300 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, selectedCharityPercentage),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <Link
                    href="/charities"
                    className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    Change charity or percentage
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-3xl font-bold">
                    Choose where your impact goes
                  </h2>

                  <p className="mt-4 max-w-xl leading-7 text-emerald-100">
                    Select one of our charity partners and choose a contribution
                    percentage of at least 10%.
                  </p>

                  <Link
                    href="/charities"
                    className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    Explore charities
                  </Link>
                </>
              )}
            </div>
          </article>

          {/* Draw participation */}
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Monthly draw
            </p>

            <h2 className="mt-4 text-2xl font-bold">Participation status</h2>

            <div className="mt-6 space-y-4">
              <RequirementRow
                label="Latest five scores"
                complete={hasFiveScores}
                incompleteText={`${Math.min(scoreCount, 5)}/5`}
              />

              <RequirementRow
                label="Charity selected"
                complete={hasCharitySelection}
              />

              <RequirementRow
                label="Active subscription"
                complete={isSubscriptionActive}
              />
            </div>

            {isDrawEligible ? (
              <div className="mt-6 rounded-2xl bg-emerald-50 px-5 py-4">
                <p className="font-semibold text-emerald-800">
                  You are ready for the monthly draw.
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-700">
                  Your scores, charity selection and membership are complete.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4">
                <p className="font-semibold text-amber-800">
                  Complete the remaining requirements
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-700">
                  Draw participation activates after all three requirements are
                  complete.
                </p>
              </div>
            )}

            {!isSubscriptionActive && (
              <Link
                href="/subscribe"
                className="mt-5 inline-flex rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Choose membership
              </Link>
            )}
          </article>
        </section>

        {isSubscriptionActive && (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Membership details
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {subscriptionPlanName}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  {subscriptionPrice}/{billingInterval}
                  {subscriptionPlanCode
                    ? ` · ${subscriptionPlanCode} plan`
                    : ""}
                </p>

                {renewalDate && (
                  <p className="mt-1 text-sm text-slate-500">
                    {cancelAtPeriodEnd
                      ? `Access ends on ${renewalDate}`
                      : `Next renewal: ${renewalDate}`}
                  </p>
                )}
              </div>

              <Link
                href="/subscribe"
                className="inline-flex justify-center rounded-full border border-emerald-700 px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
              >
                Manage membership
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
