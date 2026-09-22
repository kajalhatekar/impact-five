import Link from "next/link";
import { redirect } from "next/navigation";

import { PageContainer } from "@/app/components/page-container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ProfileRecord = {
  id: string;
  selected_charity_id: string | null;
  charity_percentage: number | null;
};

type SubscriptionRecord = {
  user_id: string;
  plan_id: string;
  status: string;
};

type PlanRecord = {
  id: string;
  price_paise: number;
  billing_interval: string;
  currency: string;
};

type CharityRecord = {
  id: string;
  name: string;
};

type DrawRecord = {
  id: string;
  draw_month: string;
  status: string;
  active_subscriber_count: number;
  pool_total_paise: number;
};

type WinnerRecord = {
  prize_paise: number;
  verification_status: string;
  payout_status: string;
  proof_storage_path: string | null;
};

function formatMoney(amountPaise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

function formatMonth(drawMonth: string) {
  const [year, month] = drawMonth
    .slice(0, 7)
    .split("-")
    .map(Number);

  if (!year || !month) {
    return drawMonth;
  }

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Admin overview and combined reporting dashboard.
 *
 * Collects platform-wide member, charity, draw and winner data with the service
 * role client after verifying admin access through the authenticated session.
 */
export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: isAdmin, error: adminCheckError } =
    await supabase.rpc("is_admin");

  if (adminCheckError || !isAdmin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const [
    profilesResult,
    subscriptionsResult,
    plansResult,
    charitiesResult,
    drawsResult,
    winnersResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, selected_charity_id, charity_percentage"),

    admin
      .from("subscriptions")
      .select("user_id, plan_id, status")
      .in("status", ["active", "trialing"]),

    admin
      .from("subscription_plans")
      .select("id, price_paise, billing_interval, currency"),

    admin.from("charities").select("id, name"),

    admin
      .from("draws")
      .select(
        `
          id,
          draw_month,
          status,
          active_subscriber_count,
          pool_total_paise
        `,
      )
      .order("draw_month", {
        ascending: false,
      }),

    admin
      .from("draw_winners")
      .select(
        `
          prize_paise,
          verification_status,
          payout_status,
          proof_storage_path
        `,
      ),
  ]);

  const pageError =
    profilesResult.error ??
    subscriptionsResult.error ??
    plansResult.error ??
    charitiesResult.error ??
    drawsResult.error ??
    winnersResult.error;

  const profiles =
    (profilesResult.data as ProfileRecord[] | null) ?? [];
  const subscriptions =
    (subscriptionsResult.data as SubscriptionRecord[] | null) ?? [];
  const plans = (plansResult.data as PlanRecord[] | null) ?? [];
  const charities =
    (charitiesResult.data as CharityRecord[] | null) ?? [];
  const draws = (drawsResult.data as DrawRecord[] | null) ?? [];
  const winners =
    (winnersResult.data as WinnerRecord[] | null) ?? [];

  const subscriptionByUserId = new Map(
    subscriptions.map((subscription) => [
      subscription.user_id,
      subscription,
    ]),
  );

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const charityById = new Map(
    charities.map((charity) => [charity.id, charity]),
  );

  const charityTotals = new Map<
    string,
    {
      name: string;
      supporters: number;
      monthlyEquivalentPaise: number;
    }
  >();

  /*
   * Convert each active subscription's selected charity percentage into a
   * monthly equivalent so monthly and yearly plans can be reported together.
   */
  for (const profile of profiles) {
    if (!profile.selected_charity_id) {
      continue;
    }

    const subscription = subscriptionByUserId.get(profile.id);
    const charity = charityById.get(profile.selected_charity_id);
    const plan = subscription ? planById.get(subscription.plan_id) : null;

    if (!subscription || !charity || !plan) {
      continue;
    }

    const percentage = profile.charity_percentage ?? 0;
    const contributionPaise = Math.round(
      plan.price_paise * (percentage / 100),
    );
    const monthlyEquivalentPaise =
      plan.billing_interval === "year"
        ? Math.round(contributionPaise / 12)
        : contributionPaise;

    const existing = charityTotals.get(charity.id);

    if (existing) {
      existing.supporters += 1;
      existing.monthlyEquivalentPaise += monthlyEquivalentPaise;
    } else {
      charityTotals.set(charity.id, {
        name: charity.name,
        supporters: 1,
        monthlyEquivalentPaise,
      });
    }
  }

  const charitySummary = [...charityTotals.values()].sort(
    (firstCharity, secondCharity) =>
      secondCharity.monthlyEquivalentPaise -
      firstCharity.monthlyEquivalentPaise,
  );

  const totalMonthlyCharityPaise = charitySummary.reduce(
    (total, charity) => total + charity.monthlyEquivalentPaise,
    0,
  );

  const totalPrizePoolPaise = draws.reduce(
    (total, draw) => total + (draw.pool_total_paise ?? 0),
    0,
  );

  const latestDraw = draws[0] ?? null;
  const publishedDrawCount = draws.filter(
    (draw) => draw.status === "published",
  ).length;
  const simulatedDrawCount = draws.filter(
    (draw) => draw.status === "simulated",
  ).length;
  const draftDrawCount = draws.filter(
    (draw) => draw.status === "draft",
  ).length;

  const proofsWaitingForReview = winners.filter(
    (winner) =>
      winner.verification_status === "pending" &&
      Boolean(winner.proof_storage_path),
  ).length;

  const totalPrizePaidPaise = winners
    .filter((winner) => winner.payout_status === "paid")
    .reduce((total, winner) => total + winner.prize_paise, 0);

  const headlineStats = [
    {
      label: "Total users",
      value: String(profiles.length),
      description: "All subscriber and administrator profiles.",
    },
    {
      label: "Active memberships",
      value: String(subscriptions.length),
      description: "Active or trialing memberships.",
    },
    {
      label: "Total prize pool",
      value: formatMoney(totalPrizePoolPaise),
      description: "Combined prize pools across created draws.",
    },
    {
      label: "Monthly charity total",
      value: formatMoney(totalMonthlyCharityPaise),
      description: "Estimated recurring allocation per month.",
    },
  ];

  const operations = [
    {
      href: "/admin/members",
      label: "Members",
      title: "Member management",
      description:
        "Review users, roles, subscriptions and member score records.",
      className:
        "border-emerald-900 bg-emerald-900 text-white hover:bg-emerald-800 hover:shadow-xl",
      labelClassName: "text-emerald-200",
      descriptionClassName: "text-emerald-50",
    },
    {
      href: "/admin/charities",
      label: "Charities",
      title: "Charity management",
      description:
        "Manage charity profiles and review contribution allocations.",
      className:
        "border-teal-800 bg-teal-800 text-white hover:bg-teal-700 hover:shadow-xl",
      labelClassName: "text-teal-100",
      descriptionClassName: "text-teal-50",
    },
    {
      href: "/admin/draws",
      label: "Draws",
      title: "Draw management",
      description:
        "Simulate, review and publish monthly draw results.",
      className:
        "border-slate-950 bg-slate-950 text-white hover:bg-slate-800 hover:shadow-xl",
      labelClassName: "text-emerald-200",
      descriptionClassName: "text-slate-200",
    },
    {
      href: "/admin/winners",
      label: "Winners",
      title: "Winner management",
      description:
        "Review submitted proof and manage payout status.",
      className:
        "border-amber-800 bg-amber-700 text-white hover:bg-amber-600 hover:shadow-xl",
      labelClassName: "text-amber-100",
      descriptionClassName: "text-amber-50",
    },
  ];

  return (
    <PageContainer>
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700">
          Administrator
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
          Admin control
        </h1>

        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          Manage members, charities, draws and winners, then review
          combined platform reports below.
        </p>
      </div>

      {pageError && (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
        >
          Some administrator reports could not be loaded:{" "}
          {pageError.message}
        </div>
      )}

      <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {operations.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-3xl border p-7 shadow-sm transition hover:-translate-y-1 ${item.className}`}
          >
            <p
              className={`text-sm font-bold uppercase tracking-widest ${item.labelClassName}`}
            >
              {item.label}
            </p>

            <h2 className="mt-3 text-2xl font-bold">{item.title}</h2>

            <p
              className={`mt-3 text-sm leading-6 ${item.descriptionClassName}`}
            >
              {item.description}
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
          Reports and analytics
        </p>

        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Platform performance
        </h2>
      </section>

      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {headlineStats.map((statistic) => (
          <article
            key={statistic.label}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-500">
              {statistic.label}
            </p>

            <p className="mt-3 text-4xl font-bold text-slate-950">
              {statistic.value}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {statistic.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                Draw statistics
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Monthly draw activity
              </h2>
            </div>

            <Link
              href="/admin/draws"
              className="font-bold text-emerald-700 transition hover:text-emerald-900"
            >
              Manage draws -&gt;
            </Link>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-100 p-5">
              <p className="text-sm font-semibold text-emerald-900">
                Published
              </p>
              <p className="mt-2 text-3xl font-bold">
                {publishedDrawCount}
              </p>
            </div>

            <div className="rounded-2xl bg-sky-100 p-5">
              <p className="text-sm font-semibold text-sky-900">
                Simulated
              </p>
              <p className="mt-2 text-3xl font-bold">
                {simulatedDrawCount}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-800">
                Draft
              </p>
              <p className="mt-2 text-3xl font-bold">
                {draftDrawCount}
              </p>
            </div>
          </div>

          {latestDraw ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-800">
                Latest draw
              </p>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xl font-bold">
                    {formatMonth(latestDraw.draw_month)}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {formatStatus(latestDraw.status)} |{" "}
                    {latestDraw.active_subscriber_count} active
                    subscriber
                    {latestDraw.active_subscriber_count === 1
                      ? ""
                      : "s"}
                  </p>
                </div>

                <p className="text-2xl font-bold text-emerald-800">
                  {formatMoney(latestDraw.pool_total_paise)}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-slate-600">
              No monthly draws have been created yet.
            </p>
          )}
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                Winner review
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Prize status
              </h2>
            </div>

            <Link
              href="/admin/winners"
              className="font-bold text-emerald-700 transition hover:text-emerald-900"
            >
              Review -&gt;
            </Link>
          </div>

          <div className="mt-7 space-y-4">
            <div className="rounded-2xl bg-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-800">
                Total winners
              </p>
              <p className="mt-2 text-3xl font-bold">
                {winners.length}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-100 p-5">
              <p className="text-sm font-semibold text-amber-900">
                Proofs waiting for review
              </p>
              <p className="mt-2 text-3xl font-bold text-amber-900">
                {proofsWaitingForReview}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-100 p-5">
              <p className="text-sm font-semibold text-emerald-900">
                Prizes paid
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-900">
                {formatMoney(totalPrizePaidPaise)}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Charity contribution totals
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Recurring impact by charity
            </h2>
          </div>

          <Link
            href="/admin/charities"
            className="font-bold text-emerald-700 transition hover:text-emerald-900"
          >
            Manage charities -&gt;
          </Link>
        </div>

        {charitySummary.length === 0 ? (
          <p className="mt-7 rounded-2xl bg-slate-50 p-5 text-slate-600">
            No active subscribers currently have a charity allocation.
          </p>
        ) : (
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {charitySummary.slice(0, 6).map((charity) => (
              <article
                key={charity.name}
                className="rounded-2xl bg-slate-50 p-5"
              >
                <p className="font-bold">{charity.name}</p>

                <p className="mt-1 text-sm text-slate-500">
                  {charity.supporters} active supporter
                  {charity.supporters === 1 ? "" : "s"}
                </p>

                <p className="mt-4 text-2xl font-bold text-emerald-700">
                  {formatMoney(charity.monthlyEquivalentPaise)}
                  /month
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

    </PageContainer>
  );
}
