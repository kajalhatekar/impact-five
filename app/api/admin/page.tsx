import Link from "next/link";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type WinnerRow = {
  prize_paise: number;
  verification_status: string;
  payout_status: string;
  proof_storage_path: string | null;
};

type RecentDraw = {
  id: string;
  draw_month: string;
  status: string;
  active_subscriber_count: number;
  pool_total_paise: number;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMonth(drawMonth: string) {
  const [year, month] = drawMonth
    .slice(0, 7)
    .split("-");

  const monthIndex = Number(month) - 1;

  if (
    !year ||
    Number.isNaN(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return drawMonth;
  }

  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function formatCurrency(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) => character.toUpperCase(),
    );
}

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const {
    data: isAdmin,
    error: adminCheckError,
  } = await supabase.rpc("is_admin");

  if (adminCheckError || !isAdmin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const [
    profileResult,
    subscriptionResult,
    drawCountResult,
    winnerResult,
    recentDrawResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id", {
        count: "exact",
        head: true,
      }),

    admin
      .from("subscriptions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .in("status", ["active", "trialing"]),

    admin
      .from("draws")
      .select("id", {
        count: "exact",
        head: true,
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
      })
      .limit(3),
  ]);

  const winners =
    (winnerResult.data as WinnerRow[] | null) ??
    [];

  const recentDraws =
    (recentDrawResult.data as
      | RecentDraw[]
      | null) ?? [];

  const totalUsers =
    profileResult.count ?? 0;

  const activeSubscribers =
    subscriptionResult.count ?? 0;

  const totalDraws =
    drawCountResult.count ?? 0;

  const totalWinners = winners.length;

  const proofsWaitingForReview =
    winners.filter(
      (winner) =>
        winner.verification_status === "pending" &&
        Boolean(winner.proof_storage_path),
    ).length;

  const totalPrizePaidPaise =
    winners
      .filter(
        (winner) =>
          winner.payout_status === "paid",
      )
      .reduce(
        (total, winner) =>
          total + winner.prize_paise,
        0,
      );

  const loadingError =
    profileResult.error ||
    subscriptionResult.error ||
    drawCountResult.error ||
    winnerResult.error ||
    recentDrawResult.error;

  const statistics = [
    {
      label: "Registered users",
      value: String(totalUsers),
      description:
        "All subscriber and administrator accounts.",
    },
    {
      label: "Active memberships",
      value: String(activeSubscribers),
      description:
        "Currently active or trialing subscriptions.",
    },
    {
      label: "Monthly draws",
      value: String(totalDraws),
      description:
        "Draft, simulated and published draws.",
    },
    {
      label: "Total winners",
      value: String(totalWinners),
      description:
        "Users with three or more matching scores.",
    },
    {
      label: "Proofs to review",
      value: String(proofsWaitingForReview),
      description:
        "Submitted proofs waiting for a decision.",
    },
    {
      label: "Prizes paid",
      value: formatCurrency(
        totalPrizePaidPaise,
      ),
      description:
        "Total value of completed prize payouts.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f1e9] px-5 py-10 text-slate-950 sm:px-8 lg:py-16">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-slate-950 px-7 py-10 text-white sm:px-10 lg:px-14">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
            Administrator
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
            Platform overview
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Monitor memberships, monthly draws, winner
            verification and completed prize payouts.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin/draws"
              className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
            >
              Manage draws
            </Link>

            <Link
              href="/admin/winners"
              className="rounded-full border border-slate-600 px-5 py-3 text-sm font-bold text-white transition hover:border-emerald-300 hover:text-emerald-300"
            >
              Review winners
            </Link>

            <Link
              href="/dashboard"
              className="rounded-full border border-slate-600 px-5 py-3 text-sm font-bold text-white transition hover:border-emerald-300 hover:text-emerald-300"
            >
              User dashboard
            </Link>
          </div>
        </div>

        {loadingError && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
          >
            Some administrator statistics could not be
            loaded: {loadingError.message}
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {statistics.map((statistic) => (
            <article
              key={statistic.label}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm"
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
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
                Recent activity
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                Latest monthly draws
              </h2>
            </div>

            <Link
              href="/admin/draws"
              className="font-bold text-emerald-700 hover:text-emerald-900"
            >
              View all draws →
            </Link>
          </div>

          {recentDraws.length === 0 ? (
            <p className="mt-7 text-slate-600">
              No monthly draws have been created yet.
            </p>
          ) : (
            <div className="mt-7 space-y-4">
              {recentDraws.map((draw) => (
                <article
                  key={draw.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold">
                        {formatMonth(
                          draw.draw_month,
                        )}
                      </h3>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800">
                        {formatStatus(draw.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {
                        draw.active_subscriber_count
                      }{" "}
                      active subscriber
                      {draw.active_subscriber_count === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-sm text-slate-500">
                      Prize pool
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {formatCurrency(
                        draw.pool_total_paise,
                      )}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}