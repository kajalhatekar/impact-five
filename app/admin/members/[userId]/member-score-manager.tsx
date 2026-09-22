"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type AdminScoreRecord = {
  id: string;
  score: number;
  played_on: string;
  created_at: string;
};

type MemberScoreManagerProps = {
  userId: string;
  initialScores: AdminScoreRecord[];
};

type ScoreApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  score?: AdminScoreRecord;
};

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

function sortScores(scores: AdminScoreRecord[]) {
  return [...scores].sort((firstScore, secondScore) => {
    const dateComparison =
      secondScore.played_on.localeCompare(
        firstScore.played_on,
      );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return secondScore.created_at.localeCompare(
      firstScore.created_at,
    );
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function MemberScoreManager({
  userId,
  initialScores,
}: MemberScoreManagerProps) {
  const router = useRouter();

  const [scores, setScores] = useState(
    sortScores(initialScores),
  );

  const [scoreValue, setScoreValue] = useState("");
  const [playedOn, setPlayedOn] = useState("");
  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [feedback, setFeedback] =
    useState<Feedback>(null);

  function resetForm() {
    setScoreValue("");
    setPlayedOn("");
    setEditingId(null);
  }

  function startEditing(score: AdminScoreRecord) {
    setEditingId(score.id);
    setScoreValue(String(score.score));
    setPlayedOn(score.played_on);
    setFeedback(null);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFeedback(null);

    const numericScore = Number(scoreValue);

    if (
      !Number.isInteger(numericScore) ||
      numericScore < 1 ||
      numericScore > 45
    ) {
      setFeedback({
        type: "error",
        message:
          "Enter a whole-number score between 1 and 45.",
      });

      return;
    }

    if (!playedOn) {
      setFeedback({
        type: "error",
        message: "Select the date the round was played.",
      });

      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/admin/members/scores",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            scoreId: editingId ?? undefined,
            score: numericScore,
            playedOn,
          }),
        },
      );

      const result =
        (await response.json()) as ScoreApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? "Unable to save the score.",
        );
      }

      if (result.score) {
        if (editingId) {
          setScores((currentScores) =>
            sortScores(
              currentScores.map((score) =>
                score.id === result.score?.id
                  ? result.score
                  : score,
              ),
            ),
          );
        } else {
          setScores((currentScores) =>
            sortScores([
              result.score as AdminScoreRecord,
              ...currentScores,
            ]).slice(0, 5),
          );
        }
      }

      resetForm();

      setFeedback({
        type: "success",
        message:
          result.message ??
          "The score was saved successfully.",
      });

      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save the score.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteScore(scoreId: string) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this member's score?",
    );

    if (!shouldDelete) {
      return;
    }

    setFeedback(null);
    setDeletingId(scoreId);

    try {
      const response = await fetch(
        "/api/admin/members/scores",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            scoreId,
          }),
        },
      );

      const result =
        (await response.json()) as ScoreApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? "Unable to delete the score.",
        );
      }

      setScores((currentScores) =>
        currentScores.filter(
          (score) => score.id !== scoreId,
        ),
      );

      if (editingId === scoreId) {
        resetForm();
      }

      setFeedback({
        type: "success",
        message:
          result.message ??
          "Score deleted successfully.",
      });

      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete the score.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="grid items-start gap-8 lg:grid-cols-[360px_1fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
          Administrator controls
        </p>

        <h2 className="mt-3 text-2xl font-bold text-slate-950">
          {editingId ? "Edit score" : "Add score"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Scores must be whole numbers between 1 and 45.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-5"
        >
          <div>
            <label
              htmlFor="admin-score"
              className="block text-sm font-semibold text-slate-700"
            >
              Stableford score
            </label>

            <input
              id="admin-score"
              type="number"
              min={1}
              max={45}
              step={1}
              required
              disabled={isSaving}
              value={scoreValue}
              onChange={(event) => {
                setScoreValue(event.target.value);
                setFeedback(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="admin-played-on"
              className="block text-sm font-semibold text-slate-700"
            >
              Date played
            </label>

            <input
              id="admin-played-on"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              disabled={isSaving}
              value={playedOn}
              onChange={(event) => {
                setPlayedOn(event.target.value);
                setFeedback(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-full bg-emerald-800 px-5 py-3 font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={isSaving}
              onClick={resetForm}
              className="w-full rounded-full border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel editing
            </button>
          )}
        </form>

        {feedback && (
          <p
            role={
              feedback.type === "error"
                ? "alert"
                : "status"
            }
            className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
              feedback.type === "error"
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Member score history
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {scores.length} of 5 scores recorded
            </p>
          </div>

          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">
            Latest five
          </span>
        </div>

        {scores.length === 0 ? (
          <div className="mt-7 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <p className="font-semibold text-slate-950">
              No scores recorded
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Add this member’s first score using the form.
            </p>
          </div>
        ) : (
          <div className="mt-7 space-y-3">
            {scores.map((score, index) => (
              <article
                key={score.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-800">
                    {score.score}
                  </span>

                  <div>
                    <p className="font-semibold text-slate-950">
                      {index === 0
                        ? "Most recent score"
                        : "Stableford score"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(score.played_on)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() => startEditing(score)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() =>
                      void deleteScore(score.id)
                    }
                    className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingId === score.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}