"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export type DrawRecord = {
  id: string;
  draw_month: string;
  status: "draft" | "simulated" | "published" | "closed";
  draw_mode: "random" | "weighted";
  winning_numbers: number[];
  active_subscriber_count: number;
  pool_total_paise: number;
  five_match_pool_paise: number;
  four_match_pool_paise: number;
  three_match_pool_paise: number;
  jackpot_brought_forward_paise: number;
  jackpot_carried_forward_paise: number;
  simulated_at: string | null;
  published_at: string | null;
  created_at: string;
};

type DrawManagerProps = {
  initialDraws: DrawRecord[];
};

type SimulationResult = {
  id: string;
  drawMonth: string;
  drawMode: "random" | "weighted";
  winningNumbers: number[];
  activeSubscriberCount: number;
  eligibleEntryCount: number;
  poolTotalPaise: number;
  tiers: {
    fiveMatch: {
      basePoolPaise: number;
      jackpotBroughtForwardPaise: number;
      availablePoolPaise: number;
      winnerCount: number;
      carriedForwardPaise: number;
    };
    fourMatch: {
      poolPaise: number;
      winnerCount: number;
    };
    threeMatch: {
      poolPaise: number;
      winnerCount: number;
    };
  };
};

type SimulationResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  draw?: SimulationResult;
};

type PublishResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

function formatCurrency(pricePaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
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

function getStatusClasses(status: DrawRecord["status"]) {
  switch (status) {
    case "published":
      return "bg-emerald-100 text-emerald-800";

    case "simulated":
      return "bg-blue-100 text-blue-800";

    case "closed":
      return "bg-slate-200 text-slate-700";

    default:
      return "bg-amber-100 text-amber-800";
  }
}

export default function DrawManager({
  initialDraws,
}: DrawManagerProps) {
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] =
    useState("");

  const [drawMode, setDrawMode] = useState<
    "random" | "weighted"
  >("random");

  const [isSimulating, setIsSimulating] =
    useState(false);

  const [publishingId, setPublishingId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null);

  async function handleSimulation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedMonth) {
      setIsError(true);
      setMessage("Please select a draw month.");
      return;
    }

    setIsSimulating(true);
    setIsError(false);
    setMessage("");
    setSimulationResult(null);

    try {
      const response = await fetch(
        "/api/admin/draws/simulate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            drawMonth: `${selectedMonth}-01`,
            drawMode,
          }),
        },
      );

      const result =
        (await response.json()) as SimulationResponse;

      if (
        !response.ok ||
        !result.success ||
        !result.draw
      ) {
        throw new Error(
          result.error ?? "Unable to simulate the draw.",
        );
      }

      setSimulationResult(result.draw);

      setMessage(
        result.message ??
          "Monthly draw simulated successfully.",
      );

      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to simulate the draw.",
      );
    } finally {
      setIsSimulating(false);
    }
  }

  async function publishDraw(drawId: string) {
    const shouldPublish = window.confirm(
      "Publishing makes this draw visible to users and prevents further simulation. Continue?",
    );

    if (!shouldPublish) {
      return;
    }

    setPublishingId(drawId);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/draws/publish",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            drawId,
          }),
        },
      );

      const result =
        (await response.json()) as PublishResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? "Unable to publish the draw.",
        );
      }

      setMessage(
        result.message ??
          "Draw published successfully.",
      );

      setSimulationResult(null);
      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to publish the draw.",
      );
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form
          onSubmit={handleSimulation}
          className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-9"
        >
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            New simulation
          </p>

          <h2 className="mt-3 text-3xl font-bold">
            Configure draw
          </h2>

          <div className="mt-8">
            <label
              htmlFor="drawMonth"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Draw month
            </label>

            <input
              id="drawMonth"
              type="month"
              required
              value={selectedMonth}
              onChange={(event) =>
                setSelectedMonth(event.target.value)
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="mt-6">
            <label
              htmlFor="drawMode"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Draw logic
            </label>

            <select
              id="drawMode"
              value={drawMode}
              onChange={(event) =>
                setDrawMode(
                  event.target.value as
                    | "random"
                    | "weighted",
                )
              }
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="random">
                Random lottery
              </option>

              <option value="weighted">
                Weighted by score frequency
              </option>
            </select>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            {drawMode === "weighted"
              ? "Numbers recorded more frequently in eligible users’ latest scores receive a higher chance of selection."
              : "Five unique numbers are selected randomly from 1 to 45."}
          </div>

          <button
            type="submit"
            disabled={isSimulating}
            className="mt-8 w-full rounded-full bg-emerald-700 px-6 py-4 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSimulating
              ? "Simulating draw..."
              : "Simulate draw"}
          </button>
        </form>

        <section className="rounded-[2rem] bg-emerald-950 p-7 text-white shadow-sm sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
            Simulation preview
          </p>

          {simulationResult ? (
            <>
              <h2 className="mt-3 text-3xl font-bold">
                {formatMonth(simulationResult.drawMonth)}
              </h2>

              <div className="mt-7 flex flex-wrap gap-3">
                {simulationResult.winningNumbers.map(
                  (number) => (
                    <span
                      key={number}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-bold text-emerald-950"
                    >
                      {number}
                    </span>
                  ),
                )}
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-emerald-200">
                    Active subscribers
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {
                      simulationResult.activeSubscriberCount
                    }
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-emerald-200">
                    Eligible entries
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {simulationResult.eligibleEntryCount}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4 sm:col-span-2">
                  <p className="text-sm text-emerald-200">
                    Total prize pool
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {formatCurrency(
                      simulationResult.poolTotalPaise,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span>5 matches</span>

                  <span className="font-bold">
                    {formatCurrency(
                      simulationResult.tiers.fiveMatch
                        .availablePoolPaise,
                    )}{" "}
                    ·{" "}
                    {
                      simulationResult.tiers.fiveMatch
                        .winnerCount
                    }{" "}
                    winners
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span>4 matches</span>

                  <span className="font-bold">
                    {formatCurrency(
                      simulationResult.tiers.fourMatch
                        .poolPaise,
                    )}{" "}
                    ·{" "}
                    {
                      simulationResult.tiers.fourMatch
                        .winnerCount
                    }{" "}
                    winners
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span>3 matches</span>

                  <span className="font-bold">
                    {formatCurrency(
                      simulationResult.tiers.threeMatch
                        .poolPaise,
                    )}{" "}
                    ·{" "}
                    {
                      simulationResult.tiers.threeMatch
                        .winnerCount
                    }{" "}
                    winners
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-white/30 px-6 py-14 text-center">
              <p className="font-semibold">
                No simulation selected
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-200">
                Choose a month and draw mode to preview the
                winning numbers and prize distribution.
              </p>
            </div>
          )}
        </section>
      </section>

      {message && (
        <div
          role={isError ? "alert" : "status"}
          className={`rounded-2xl border px-5 py-4 ${
            isError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </div>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Draw history
          </p>

          <h2 className="mt-3 text-3xl font-bold">
            Monthly draws
          </h2>
        </div>

        {initialDraws.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">
            No draws have been created yet.
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {initialDraws.map((draw) => (
              <article
                key={draw.id}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold">
                        {formatMonth(draw.draw_month)}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${getStatusClasses(
                          draw.status,
                        )}`}
                      >
                        {draw.status}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">
                        {draw.draw_mode}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {draw.winning_numbers.map(
                        (number) => (
                          <span
                            key={number}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900"
                          >
                            {number}
                          </span>
                        ),
                      )}
                    </div>

                    <p className="mt-4 text-sm text-slate-600">
                      Pool:{" "}
                      <strong>
                        {formatCurrency(
                          draw.pool_total_paise,
                        )}
                      </strong>{" "}
                      · Subscribers:{" "}
                      <strong>
                        {draw.active_subscriber_count}
                      </strong>
                    </p>

                    {draw.jackpot_carried_forward_paise >
                      0 && (
                      <p className="mt-2 text-sm font-semibold text-amber-700">
                        Jackpot rollover:{" "}
                        {formatCurrency(
                          draw.jackpot_carried_forward_paise,
                        )}
                      </p>
                    )}
                  </div>

                  {draw.status === "simulated" && (
                    <button
                      type="button"
                      disabled={publishingId !== null}
                      onClick={() =>
                        void publishDraw(draw.id)
                      }
                      className="rounded-full bg-emerald-700 px-6 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {publishingId === draw.id
                        ? "Publishing..."
                        : "Publish draw"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}