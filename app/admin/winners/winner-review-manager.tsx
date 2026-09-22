"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type WinnerReviewRecord = {
  id: string;
  userName: string;
  userEmail: string;
  drawMonth: string;
  matchCount: number;
  prizePaise: number;
  verificationStatus: string;
  payoutStatus: string;
  proofUrl: string | null;
  proofSubmittedAt: string | null;
};

type WinnerReviewManagerProps = {
  initialWinners: WinnerReviewRecord[];
};

type UpdateWinnerBody = {
  winnerId: string;
  verificationStatus?: string;
  payoutStatus?: string;
};

type UpdateResponse = {
  success?: boolean;
  message?: string;
  error?: string;
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
  const [year, month] = drawMonth.slice(0, 7).split("-");

  const monthIndex = Number(month) - 1;

  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
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

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getVerificationClasses(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-800";

    case "rejected":
      return "bg-red-100 text-red-800";

    default:
      return "bg-amber-100 text-amber-900";
  }
}

function getPayoutClasses(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-800";

    case "processing":
      return "bg-blue-100 text-blue-800";

    case "failed":
      return "bg-red-100 text-red-800";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

/**
 * Admin review surface for winner verification and payout tracking.
 *
 * Proof approval must happen before payout status changes, and rejected proofs
 * reset payout progress so the subscriber can upload a replacement document.
 */
export default function WinnerReviewManager({
  initialWinners,
}: WinnerReviewManagerProps) {
  const router = useRouter();

  const [winners, setWinners] = useState(initialWinners);

  const [updatingWinnerId, setUpdatingWinnerId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  async function updateWinner(body: UpdateWinnerBody) {
    setUpdatingWinnerId(body.winnerId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/winners/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = (await response.json()) as UpdateResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ?? "The winner status could not be updated.",
        );

        return;
      }

      setWinners((currentWinners) =>
        currentWinners.map((winner) => {
          if (winner.id !== body.winnerId) {
            return winner;
          }

          const nextWinner = {
            ...winner,
          };

          if (body.verificationStatus) {
            nextWinner.verificationStatus = body.verificationStatus;

            if (body.verificationStatus === "rejected") {
              nextWinner.payoutStatus = "pending";
            }
          }

          if (body.payoutStatus) {
            nextWinner.payoutStatus = body.payoutStatus;
          }

          return nextWinner;
        }),
      );

      setSuccessMessage(
        result.message ?? "Winner status updated successfully.",
      );

      router.refresh();
    } catch (error) {
      console.error("Winner status request failed:", error);

      setErrorMessage("Unable to update the winner. Please try again.");
    } finally {
      setUpdatingWinnerId(null);
    }
  }

  if (winners.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-2xl font-bold text-slate-950">No winners yet</h2>

        <p className="mt-3 text-slate-600">
          Winners will appear here after a draw produces three or more matches.
        </p>
      </div>
    );
  }

  return (
    <div>
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800"
        >
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {winners.map((winner) => {
          const isUpdating = updatingWinnerId === winner.id;

          const proofApproved = winner.verificationStatus === "approved";

          return (
            <article
              key={winner.id}
              className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
            >
              <div className="grid lg:grid-cols-[1fr_0.85fr]">
                <div className="p-7 sm:p-9">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-950">
                      {winner.userName}
                    </h2>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${getVerificationClasses(
                        winner.verificationStatus,
                      )}`}
                    >
                      {formatStatus(winner.verificationStatus)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {winner.userEmail}
                  </p>

                  <div className="mt-7 grid gap-5 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-slate-500">Draw</p>

                      <p className="mt-1 font-bold text-slate-950">
                        {formatMonth(winner.drawMonth)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">Matches</p>

                      <p className="mt-1 font-bold text-slate-950">
                        {winner.matchCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">Prize</p>

                      <p className="mt-1 font-bold text-slate-950">
                        {formatCurrency(winner.prizePaise)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7">
                    <p className="text-sm font-semibold text-slate-600">
                      Winner proof
                    </p>

                    {winner.proofUrl ? (
                      <>
                      <a
                        href={winner.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-full border border-emerald-700 px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
                      >
                        View submitted proof ↗
                      </a>
                      <p className="mt-3 text-sm text-slate-500">
                        Submitted{" "}
                        {formatDate(
                          winner.proofSubmittedAt,
                        ) ?? "recently"}
                      </p>
                      </>
                    ) : (
                      <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                        The winner has not submitted proof yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-[#003d31] p-7 text-white sm:p-9">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                    Review and payout
                  </p>

                  <div className="mt-6">
                    <p className="text-sm text-emerald-200">
                      Verification status
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {formatStatus(winner.verificationStatus)}
                    </p>
                  </div>

                  {winner.verificationStatus === "pending" ? (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        disabled={isUpdating || !winner.proofUrl}
                        onClick={() =>
                          updateWinner({
                            winnerId: winner.id,
                            verificationStatus: "approved",
                          })
                        }
                        className="flex-1 rounded-full bg-emerald-400 px-5 py-3 font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-300"
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={isUpdating || !winner.proofUrl}
                        onClick={() =>
                          updateWinner({
                            winnerId: winner.id,
                            verificationStatus: "rejected",
                          })
                        }
                        className="flex-1 rounded-full border border-red-300 px-5 py-3 font-bold text-red-200 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : winner.verificationStatus === "approved" ? (
                    <div className="mt-6 rounded-2xl bg-emerald-400/15 p-4 text-emerald-200">
                      <p className="font-bold">Proof approved</p>

                      <p className="mt-1 text-sm">
                        The winner’s submitted proof has been verified.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl bg-red-400/15 p-4 text-red-200">
                      <p className="font-bold">Proof rejected</p>

                      <p className="mt-1 text-sm">
                        The winner must upload a new proof for review.
                      </p>
                    </div>
                  )}

                  <div className="mt-8 border-t border-white/20 pt-6">
                    <label
                      htmlFor={`payout-${winner.id}`}
                      className="text-sm font-semibold text-emerald-200"
                    >
                      Payout status
                    </label>

                    <select
                      id={`payout-${winner.id}`}
                      value={winner.payoutStatus}
                      disabled={isUpdating || !proofApproved}
                      onChange={(event) =>
                        updateWinner({
                          winnerId: winner.id,
                          payoutStatus: event.target.value,
                        })
                      }
                      className="mt-3 w-full rounded-xl border border-white/20 bg-white px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      <option value="pending">Pending</option>

                      <option value="processing">Processing</option>

                      <option value="paid">Paid</option>

                      <option value="failed">Failed</option>
                    </select>

                    {!proofApproved && (
                      <p className="mt-3 text-sm leading-6 text-emerald-200">
                        Approve the proof before changing the payout status.
                      </p>
                    )}
                  </div>

                  <div className="mt-6">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${getPayoutClasses(
                        winner.payoutStatus,
                      )}`}
                    >
                      Payout: {formatStatus(winner.payoutStatus)}
                    </span>
                  </div>

                  {isUpdating && (
                    <p className="mt-5 text-sm text-emerald-200">
                      Updating winner status...
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
