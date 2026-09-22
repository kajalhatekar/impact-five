"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SyntheticEvent } from "react";
import { PageContainer } from "@/app/components/page-container";
import { createClient } from "@/lib/supabase/client";

type Score = {
  id: string;
  score: number;
  played_on: string;
  created_at: string;
};

type Feedback = {
  type: "success" | "error";
  text: string;
} | null;

type Subscription = {
  subscription_status: string | null;
};

function getTodayForDateInput() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 10);
}

export default function ScoresPage() {
  const today = getTodayForDateInput();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [scores, setScores] = useState<Score[]>([]);
  const [score, setScore] = useState("");
  const [playedOn, setPlayedOn] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubscriptionActive, setIsSubscriptionActive] =
    useState(false);

  useEffect(() => {
    let isActive = true;

    async function initialiseScores() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isActive) {
        return;
      }

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { error: subscriptionRefreshError } =
        await supabase.rpc("refresh_my_subscription_status");

      if (!isActive) {
        return;
      }

      if (subscriptionRefreshError) {
        setFeedback({
          type: "error",
          text: subscriptionRefreshError.message,
        });
        setIsLoading(false);
        return;
      }

      const {
        data: subscriptionData,
        error: subscriptionError,
      } = await supabase.rpc("get_my_subscription");

      if (!isActive) {
        return;
      }

      if (subscriptionError) {
        setFeedback({
          type: "error",
          text: subscriptionError.message,
        });
        setIsLoading(false);
        return;
      }

      const subscriptions =
        (subscriptionData as Subscription[] | null) ?? [];

      const subscriptionStatus =
        subscriptions[0]?.subscription_status ?? "inactive";

      const hasActiveSubscription = [
        "active",
        "trialing",
      ].includes(subscriptionStatus);

      setIsSubscriptionActive(hasActiveSubscription);

      if (!hasActiveSubscription) {
        setFeedback({
          type: "error",
          text: "An active membership is required to manage scores.",
        });
        setScores([]);
        setIsLoading(false);
        return;
      }

      /*
       * Scores are loaded through the secure Supabase function.
       * This avoids the previous RLS problem.
       */
      const { data, error } = await supabase.rpc("get_my_scores");

      if (!isActive) {
        return;
      }

      if (error) {
        setFeedback({
          type: "error",
          text: error.message,
        });
        setScores([]);
      } else {
        setScores((data as Score[]) ?? []);
      }

      setIsLoading(false);
    }

    void initialiseScores();

    return () => {
      isActive = false;
    };
  }, [router, supabase]);

  async function refreshScores() {
    const { data, error } = await supabase.rpc("get_my_scores");

    if (error) {
      setFeedback({
        type: "error",
        text: error.message,
      });

      return false;
    }

    setScores((data as Score[]) ?? []);
    return true;
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!isSubscriptionActive) {
      setFeedback({
        type: "error",
        text: "An active membership is required to manage scores.",
      });
      return;
    }

    const numericScore = Number(score);

    if (!score || !Number.isInteger(numericScore)) {
      setFeedback({
        type: "error",
        text: "Please enter a valid whole-number Stableford score.",
      });
      return;
    }

    if (numericScore < 1 || numericScore > 45) {
      setFeedback({
        type: "error",
        text: "The Stableford score must be between 1 and 45.",
      });
      return;
    }

    if (!playedOn) {
      setFeedback({
        type: "error",
        text: "Please select the date the round was played.",
      });
      return;
    }

    if (playedOn > today) {
      setFeedback({
        type: "error",
        text: "The date played cannot be in the future.",
      });
      return;
    }

    setIsSaving(true);

    if (editingId) {
      const { error } = await supabase.rpc("update_my_score", {
        p_score_id: editingId,
        p_score: numericScore,
        p_played_on: playedOn,
      });

      if (error) {
        setFeedback({
          type: "error",
          text: getScoreErrorMessage(error.code, error.message),
        });
        setIsSaving(false);
        return;
      }

      const refreshed = await refreshScores();

      if (refreshed) {
        resetForm();
        setFeedback({
          type: "success",
          text: "Score updated successfully.",
        });
      }
    } else {
      const { error } = await supabase.rpc("add_score", {
        p_score: numericScore,
        p_played_on: playedOn,
      });

      if (error) {
        setFeedback({
          type: "error",
          text: getScoreErrorMessage(error.code, error.message),
        });
        setIsSaving(false);
        return;
      }

      const refreshed = await refreshScores();

      if (refreshed) {
        resetForm();
        setFeedback({
          type: "success",
          text: "Score added successfully. Only your latest five scores are retained.",
        });
      }
    }

    setIsSaving(false);
  }

  function startEditing(selectedScore: Score) {
    setEditingId(selectedScore.id);
    setScore(String(selectedScore.score));
    setPlayedOn(selectedScore.played_on);
    setFeedback(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetForm() {
    setEditingId(null);
    setScore("");
    setPlayedOn("");
  }

  async function deleteScore(id: string) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this score?",
    );

    if (!shouldDelete) {
      return;
    }

    setFeedback(null);
    setDeletingId(id);

    /*
     * This calls the delete function.
     * The previous code accidentally called get_my_scores here.
     */
    const { error } = await supabase.rpc("delete_my_score", {
      p_score_id: id,
    });

    if (error) {
      setFeedback({
        type: "error",
        text: error.message,
      });
      setDeletingId(null);
      return;
    }

    const refreshed = await refreshScores();

    if (refreshed) {
      if (editingId === id) {
        resetForm();
      }

      setFeedback({
        type: "success",
        text: "Score deleted successfully.",
      });
    }

    setDeletingId(null);
  }

  function getScoreErrorMessage(code: string, fallbackMessage: string) {
    if (code === "23505") {
      return "You already have a score recorded for this date. Edit or delete the existing entry.";
    }

    if (code === "23514") {
      return "The Stableford score must be between 1 and 45.";
    }

    return fallbackMessage;
  }

  function formatPlayedDate(date: string) {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return (
    <PageContainer>
        <Link
          href="/dashboard"
          className="inline-flex text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Impact Five
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Your latest scores
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
            Enter your latest Stableford scores. Your five most recent scores
            are used for monthly draw participation.
          </p>
        </header>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[380px_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <h2 className="text-2xl font-bold">
              {editingId ? "Edit score" : "Add a score"}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Scores must be between 1 and 45.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="score"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Stableford score
                </label>

                <input
                  id="score"
                  name="score"
                  type="number"
                  min={1}
                  max={45}
                  step={1}
                  required
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  placeholder="Between 1 and 45"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="playedOn"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Date played
                </label>

                <input
                  id="playedOn"
                  name="playedOn"
                  type="date"
                  max={today}
                  required
                  value={playedOn}
                  onChange={(event) => setPlayedOn(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving || !isSubscriptionActive}
                className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Saving..."
                  : editingId
                    ? "Update score"
                    : "Add score"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel editing
                </button>
              )}
            </form>

            {feedback && (
              <p
                role={feedback.type === "error" ? "alert" : "status"}
                className={`mt-5 rounded-xl px-4 py-3 text-sm leading-6 ${
                  feedback.type === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {feedback.text}
              </p>
            )}
          </section>

          <section className="min-h-[420px] rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Score history</h2>

                <p className="mt-2 text-sm text-slate-500">
                  {scores.length} of 5 scores recorded
                </p>
              </div>

              <span className="w-fit rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
                Latest five
              </span>
            </div>

            {isLoading ? (
              <div className="mt-10 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 p-10">
                <p className="text-slate-500">Loading your scores...</p>
              </div>
            ) : scores.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                <p className="font-semibold text-slate-950">
                  No scores recorded yet
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Add your first Stableford score using the form.
                </p>
              </div>
            ) : (
              <div className="mt-7 space-y-3">
                {scores.map((item, index) => (
                  <article
                    key={item.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-800">
                        {item.score}
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          {index === 0
                            ? "Most recent score"
                            : "Stableford score"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatPlayedDate(item.played_on)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        disabled={deletingId !== null}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteScore(item.id)}
                        disabled={deletingId !== null}
                        className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
    </PageContainer>
  );
}
