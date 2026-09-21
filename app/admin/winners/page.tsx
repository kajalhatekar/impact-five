import Link from "next/link";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import WinnerReviewManager, {
  type WinnerReviewRecord,
} from "./winner-review-manager";

type WinnerRow = {
  id: string;
  draw_id: string;
  user_id: string;
  match_count: number;
  prize_paise: number;
  verification_status: string;
  payout_status: string;
  proof_storage_path: string | null;
  proof_submitted_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type DrawRow = {
  id: string;
  draw_month: string;
};

export default async function AdminWinnersPage() {
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

  const {
    data: winnerData,
    error: winnerError,
  } = await admin
    .from("draw_winners")
    .select(
      `
        id,
        draw_id,
        user_id,
        match_count,
        prize_paise,
        verification_status,
        payout_status,
        proof_storage_path,
        proof_submitted_at,
        created_at
      `,
    )
    .order("created_at", {
      ascending: false,
    });

  const winners =
    (winnerData as WinnerRow[] | null) ?? [];

  const userIds = [
    ...new Set(
      winners.map((winner) => winner.user_id),
    ),
  ];

  const drawIds = [
    ...new Set(
      winners.map((winner) => winner.draw_id),
    ),
  ];

  let profiles: ProfileRow[] = [];
  let draws: DrawRow[] = [];

  let profileErrorMessage = "";
  let drawErrorMessage = "";

  if (userIds.length > 0) {
    const {
      data: profileData,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    profiles =
      (profileData as ProfileRow[] | null) ?? [];

    if (profileError) {
      profileErrorMessage = profileError.message;
    }
  }

  if (drawIds.length > 0) {
    const {
      data: drawData,
      error: drawError,
    } = await admin
      .from("draws")
      .select("id, draw_month")
      .in("id", drawIds);

    draws =
      (drawData as DrawRow[] | null) ?? [];

    if (drawError) {
      drawErrorMessage = drawError.message;
    }
  }

  const profileByUserId = new Map(
    profiles.map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const drawById = new Map(
    draws.map((draw) => [draw.id, draw]),
  );

  const emailEntries = await Promise.all(
    userIds.map(async (userId) => {
      const {
        data,
        error,
      } = await admin.auth.admin.getUserById(
        userId,
      );

      if (error || !data.user) {
        return [userId, ""] as const;
      }

      return [
        userId,
        data.user.email ?? "",
      ] as const;
    }),
  );

  const emailByUserId = new Map(emailEntries);

  const formattedWinners =
    await Promise.all(
      winners.map(
        async (
          winner,
        ): Promise<WinnerReviewRecord> => {
          const profile =
            profileByUserId.get(winner.user_id);

          const draw =
            drawById.get(winner.draw_id);

          const userEmail =
            emailByUserId.get(winner.user_id) ??
            "";

          const emailName =
            userEmail.split("@")[0] ||
            "Subscriber";

          const userName =
            profile?.full_name?.trim() ||
            emailName;

          let proofUrl: string | null = null;

          if (winner.proof_storage_path) {
            const {
              data: signedUrlData,
              error: signedUrlError,
            } = await admin.storage
              .from("winner-proofs")
              .createSignedUrl(
                winner.proof_storage_path,
                15 * 60,
              );

            if (signedUrlError) {
              console.error(
                "Unable to create proof URL:",
                signedUrlError,
              );
            } else {
              proofUrl =
                signedUrlData.signedUrl;
            }
          }

          return {
            id: winner.id,
            userName,
            userEmail,
            drawMonth:
              draw?.draw_month ?? "",
            matchCount: winner.match_count,
            prizePaise: winner.prize_paise,
            verificationStatus:
              winner.verification_status,
            payoutStatus:
              winner.payout_status,
            proofUrl,
            proofSubmittedAt:
              winner.proof_submitted_at,
          };
        },
      ),
    );

  const loadingErrorMessage =
    winnerError?.message ||
    profileErrorMessage ||
    drawErrorMessage;

  return (
    <main className="min-h-screen bg-[#f4f1e9] px-5 py-10 text-slate-950 sm:px-8 lg:py-16">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/draws"
            className="font-semibold text-emerald-700 transition hover:text-emerald-900"
          >
            ← Back to draw management
          </Link>

          <Link
            href="/dashboard"
            className="font-semibold text-slate-600 transition hover:text-emerald-800"
          >
            User dashboard
          </Link>
        </div>

        <div className="mt-10 rounded-[2rem] bg-slate-950 px-7 py-10 text-white sm:px-10 lg:px-14">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
            Administrator
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
            Winner verification
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Review submitted winner documents, approve or
            reject verification and track prize payouts.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin/draws"
              className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
            >
              Manage draws
            </Link>

            <span className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">
              {formattedWinners.length} winner
              {formattedWinners.length === 1
                ? ""
                : "s"}
            </span>
          </div>
        </div>

        {loadingErrorMessage && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
          >
            Unable to load winner information:{" "}
            {loadingErrorMessage}
          </div>
        )}

        <div className="mt-8">
          <WinnerReviewManager
            initialWinners={formattedWinners}
          />
        </div>
      </section>
    </main>
  );
}