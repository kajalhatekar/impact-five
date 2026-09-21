import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import WinnerProofUpload from "./winner-proof-upload";

type PublishedDraw = {
  id: string;
  draw_month: string;
  draw_mode: string;
  winning_numbers: number[];
  pool_total_paise: number;
  five_match_pool_paise: number;
  four_match_pool_paise: number;
  three_match_pool_paise: number;
  jackpot_carried_forward_paise: number;
  published_at: string | null;
};

type ScoreRecord = {
  id: string;
  score: number;
  played_on: string;
};

type DrawEntryRecord = {
  draw_id: string;
  score_numbers: number[];
  match_count: number;
};

type WinnerRecord = {
  id: string;
  draw_id: string;
  match_count: number;
  prize_paise: number;
  verification_status: string;
  payout_status: string;
  proof_storage_path: string | null;
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

export default async function DrawResultsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [
    { data: drawData, error: drawError },
    { data: scoreData, error: scoreError },
    { data: entryData, error: entryError },
    { data: winnerData, error: winnerError },
  ] = await Promise.all([
    supabase
      .from("draws")
      .select(
        `
          id,
          draw_month,
          draw_mode,
          winning_numbers,
          pool_total_paise,
          five_match_pool_paise,
          four_match_pool_paise,
          three_match_pool_paise,
          jackpot_carried_forward_paise,
          published_at
        `,
      )
      .eq("status", "published")
      .order("draw_month", {
        ascending: false,
      }),

    supabase.rpc("get_my_scores"),

    supabase
      .from("draw_entries")
      .select(
        `
          draw_id,
          score_numbers,
          match_count
        `,
      )
      .eq("user_id", user.id),

    supabase
      .from("draw_winners")
      .select(
        `
          id,
          draw_id,
          match_count,
          prize_paise,
          verification_status,
          payout_status,
          proof_storage_path
        `,
      )
      .eq("user_id", user.id),
  ]);

  const draws =
    (drawData as PublishedDraw[] | null) ?? [];

  const scores =
    (scoreData as ScoreRecord[] | null) ?? [];

  const entries =
    (entryData as DrawEntryRecord[] | null) ?? [];

  const winners =
    (winnerData as WinnerRecord[] | null) ?? [];

  const currentScoreNumbers = scores.map(
    (score) => score.score,
  );

  const entryByDrawId = new Map(
    entries.map((entry) => [
      entry.draw_id,
      entry,
    ]),
  );

  const winnerByDrawId = new Map(
    winners.map((winner) => [
      winner.draw_id,
      winner,
    ]),
  );

  const loadingError =
    drawError ||
    scoreError ||
    entryError ||
    winnerError;

  let loadingErrorMessage = "";

  if (drawError) {
    loadingErrorMessage =
      `Unable to load published draws: ${drawError.message}`;
  } else if (scoreError) {
    loadingErrorMessage =
      `Unable to load your scores: ${scoreError.message}`;
  } else if (entryError) {
    loadingErrorMessage =
      `Unable to load your draw entries: ${entryError.message}`;
  } else if (winnerError) {
    loadingErrorMessage =
      `Unable to load winner information: ${winnerError.message}`;
  }

  return (
    <main className="min-h-screen bg-[#f4f1e9] px-5 py-10 text-slate-950 sm:px-8 lg:py-16">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-10 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700">
            Monthly draw
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
            Your draw results
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Review published winning numbers, see the five
            scores entered into each draw and follow your
            prize status.
          </p>
        </div>

        {loadingError && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
          >
            {loadingErrorMessage}
          </div>
        )}

        <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
                Your latest five
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Current Stableford scores
              </h2>
            </div>

            <Link
              href="/dashboard/scores"
              className="font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Manage scores →
            </Link>
          </div>

          {currentScoreNumbers.length === 0 ? (
            <p className="mt-6 text-slate-600">
              You have not recorded any scores yet.
            </p>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              {currentScoreNumbers.map(
                (score, index) => (
                  <span
                    key={`${score}-${index}`}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-950"
                  >
                    {score}
                  </span>
                ),
              )}
            </div>
          )}

          <p className="mt-5 text-sm text-slate-500">
            {currentScoreNumbers.length} of 5 current
            scores available.
          </p>
        </div>

        {draws.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-2xl font-bold">
              No published draws yet
            </h2>

            <p className="mt-3 text-slate-600">
              Published monthly results will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-7">
            {draws.map((draw) => {
              const entry = entryByDrawId.get(
                draw.id,
              );

              const winner = winnerByDrawId.get(
                draw.id,
              );

              const frozenScoreNumbers =
                entry?.score_numbers ?? [];

              const winningNumberSet = new Set(
                draw.winning_numbers,
              );

              const matchingNumbers =
                frozenScoreNumbers.filter((score) =>
                  winningNumberSet.has(score),
                );

              const matchCount =
                entry?.match_count ??
                matchingNumbers.length;

              const wasEntered = Boolean(entry);

              return (
                <article
                  key={draw.id}
                  className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="p-7 sm:p-10">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-bold">
                          {formatMonth(
                            draw.draw_month,
                          )}
                        </h2>

                        <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold uppercase text-emerald-800">
                          Published
                        </span>
                      </div>

                      <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                        Winning numbers
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {draw.winning_numbers.map(
                          (number) => (
                            <span
                              key={number}
                              className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-lg font-bold text-white"
                            >
                              {number}
                            </span>
                          ),
                        )}
                      </div>

                      {wasEntered ? (
                        <>
                          <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                            Your scores entered in this draw
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3">
                            {frozenScoreNumbers.map(
                              (number, index) => {
                                const matched =
                                  winningNumberSet.has(
                                    number,
                                  );

                                return (
                                  <span
                                    key={`${number}-${index}`}
                                    className={`flex h-12 w-12 items-center justify-center rounded-full font-bold ${
                                      matched
                                        ? "bg-emerald-500 text-emerald-950 ring-4 ring-emerald-100"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {number}
                                  </span>
                                );
                              },
                            )}
                          </div>

                          <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                            Your matching scores
                          </p>

                          {matchingNumbers.length === 0 ? (
                            <p className="mt-3 text-slate-600">
                              None of your entered scores
                              matched the winning numbers.
                            </p>
                          ) : (
                            <div className="mt-4 flex flex-wrap gap-3">
                              {matchingNumbers.map(
                                (number, index) => (
                                  <span
                                    key={`${number}-${index}`}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 font-bold text-emerald-950"
                                  >
                                    {number}
                                  </span>
                                ),
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                          <p className="font-bold">
                            You were not entered in this
                            draw
                          </p>

                          <p className="mt-2 text-sm leading-6">
                            A complete set of five scores
                            and an active membership were
                            required when this draw was
                            simulated.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#003d31] p-7 text-white sm:p-10">
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                        Your result
                      </p>

                      {wasEntered ? (
                        <>
                          <p className="mt-5 text-5xl font-bold">
                            {matchCount}
                          </p>

                          <p className="mt-2 text-emerald-100">
                            {matchCount === 1
                              ? "matching number"
                              : "matching numbers"}
                          </p>

                          {winner ? (
                            <div className="mt-7 rounded-2xl bg-emerald-100 p-5 text-emerald-950">
                              <p className="font-bold">
                                Prize:{" "}
                                {formatCurrency(
                                  winner.prize_paise,
                                )}
                              </p>

                              <p className="mt-2 text-sm">
                                Verification:{" "}
                                {formatStatus(
                                  winner.verification_status,
                                )}
                              </p>

                              <p className="mt-1 text-sm">
                                Payout:{" "}
                                {formatStatus(
                                  winner.payout_status,
                                )}
                              </p>

                              <WinnerProofUpload
                                winnerId={winner.id}
                                verificationStatus={
                                  winner.verification_status
                                }
                                payoutStatus={
                                  winner.payout_status
                                }
                                hasProof={Boolean(
                                  winner.proof_storage_path,
                                )}
                              />
                            </div>
                          ) : (
                            <div className="mt-7 rounded-2xl bg-white/10 p-5">
                              <p className="font-bold">
                                No prize this month
                              </p>

                              <p className="mt-2 text-sm leading-6 text-emerald-100">
                                A minimum of three matching
                                scores is required to win.
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-7 rounded-2xl bg-white/10 p-5">
                          <p className="font-bold">
                            Not eligible for this draw
                          </p>

                          <p className="mt-2 text-sm leading-6 text-emerald-100">
                            No entry snapshot was recorded
                            for your account.
                          </p>
                        </div>
                      )}

                      <div className="mt-7 border-t border-white/20 pt-6">
                        <p className="text-sm text-emerald-200">
                          Total prize pool
                        </p>

                        <p className="mt-1 text-2xl font-bold">
                          {formatCurrency(
                            draw.pool_total_paise,
                          )}
                        </p>

                        <p className="mt-5 text-sm text-emerald-200">
                          Jackpot carried forward
                        </p>

                        <p className="mt-1 text-xl font-bold">
                          {formatCurrency(
                            draw.jackpot_carried_forward_paise,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}