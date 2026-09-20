import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type CharitySelection = {
  charity_id: string | null;
  charity_name: string | null;
  charity_percentage: number;
};

type Score = {
  id: string;
  score: number;
  played_on: string;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [charityResult, scoresResult] = await Promise.all([
    supabase.rpc("get_my_charity_selection"),
    supabase.rpc("get_my_scores"),
  ]);

  const charitySelection = (
    charityResult.data as CharitySelection[] | null
  )?.[0];

  const scores = (scoresResult.data as Score[] | null) ?? [];
  const scoreCount = scores.length;
  const hasFiveScores = scoreCount === 5;

  const firstName =
    user.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return (
    <main className="min-h-screen bg-[#f4f1e9] text-slate-950">
      <header className="border-b border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-lg font-black uppercase tracking-[0.16em] text-emerald-800"
          >
            Impact Five
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/charities"
              className="text-sm font-semibold text-slate-700 transition hover:text-emerald-700"
            >
              Charities
            </Link>

            <span className="hidden text-sm text-slate-500 sm:inline">
              {user.email}
            </span>
          </nav>
        </div>
      </header>

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

        {(charityResult.error || scoresResult.error) && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            {charityResult.error?.message ?? scoresResult.error?.message}
          </div>
        )}

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-xl">
              ◷
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Subscription
            </p>

            <p className="mt-1 text-xl font-bold text-slate-950">
              Not active
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Choose a monthly or yearly plan to participate in draws.
            </p>

            <span className="mt-5 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Setup coming next
            </span>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl">
              ✓
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Latest scores
            </p>

            <p className="mt-1 text-xl font-bold text-slate-950">
              {scoreCount} of 5
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {hasFiveScores
                ? "Your latest five Stableford scores are recorded."
                : `Add ${5 - scoreCount} more ${
                    5 - scoreCount === 1 ? "score" : "scores"
                  } to complete your latest five.`}
            </p>

            <Link
              href="/dashboard/scores"
              className="mt-5 inline-flex text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
            >
              Manage scores →
            </Link>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-100 text-xl">
              ♥
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Charity contribution
            </p>

            {charitySelection?.charity_id ? (
              <>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  {charitySelection.charity_percentage}%
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Supporting {charitySelection.charity_name}.
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

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-xl">
              ◇
            </div>

            <p className="mt-5 text-sm font-semibold text-slate-500">
              Total winnings
            </p>

            <p className="mt-1 text-xl font-bold text-slate-950">£0.00</p>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your winnings and payment status will appear here.
            </p>

            <span className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              No winnings yet
            </span>
          </article>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <article className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-sm">
            <div className="p-7 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                Your chosen cause
              </p>

              {charitySelection?.charity_id ? (
                <>
                  <h2 className="mt-4 text-3xl font-bold">
                    {charitySelection.charity_name}
                  </h2>

                  <p className="mt-4 max-w-xl leading-7 text-emerald-100">
                    You have chosen to direct{" "}
                    <strong className="text-white">
                      {charitySelection.charity_percentage}%
                    </strong>{" "}
                    of your subscription contribution towards this charity.
                  </p>

                  <div className="mt-7">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>Contribution percentage</span>
                      <span className="font-bold">
                        {charitySelection.charity_percentage}%
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-emerald-300"
                        style={{
                          width: `${charitySelection.charity_percentage}%`,
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

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Monthly draw
            </p>

            <h2 className="mt-4 text-2xl font-bold">Participation status</h2>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
                <span className="text-sm text-slate-600">
                  Latest five scores
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    hasFiveScores
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {hasFiveScores ? "Complete" : `${scoreCount}/5`}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
                <span className="text-sm text-slate-600">
                  Charity selected
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    charitySelection?.charity_id
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {charitySelection?.charity_id ? "Complete" : "Required"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
                <span className="text-sm text-slate-600">
                  Active subscription
                </span>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Required
                </span>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-500">
              Draw participation will activate after the subscription system is
              connected.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}