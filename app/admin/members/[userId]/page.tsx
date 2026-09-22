import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { PageContainer } from "@/app/components/page-container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import MemberScoreManager, {
  type AdminScoreRecord,
} from "./member-score-manager";

import MemberSubscriptionManager, {
  type AdminSubscriptionRecord,
} from "./member-subscription-manager";

type AdminMemberPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
};

type PlanRecord = {
  id: string;
  name: string;
};

function formatDate(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

/**
 * Admin detail page for one member.
 *
 * Loads the selected user's auth profile, subscription and score history so
 * admins can resolve support issues without switching to the member account.
 */
export default async function AdminMemberPage({
  params,
}: AdminMemberPageProps) {
  const { userId } = await params;

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
    authUserResult,
    profileResult,
    scoresResult,
    subscriptionResult,
    plansResult,
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),

    admin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("id", userId)
      .maybeSingle(),

    admin
      .from("scores")
      .select("id, score, played_on, created_at")
      .eq("user_id", userId)
      .order("played_on", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      }),

    admin
      .from("subscriptions")
      .select(
        `
          id,
          plan_id,
          status,
          payment_provider,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          razorpay_subscription_id
        `,
      )
      .eq("user_id", userId)
      .maybeSingle(),

    admin
      .from("subscription_plans")
      .select("id, name"),
  ]);

  const selectedAuthUser =
    authUserResult.data.user;

  if (!selectedAuthUser) {
    notFound();
  }

  const profile =
    profileResult.data as ProfileRecord | null;

  const scores =
    (scoresResult.data as AdminScoreRecord[] | null) ??
    [];

  const subscription =
    subscriptionResult.data as AdminSubscriptionRecord | null;

  const plans =
    (plansResult.data as PlanRecord[] | null) ?? [];

  const selectedPlan = subscription?.plan_id
    ? plans.find(
        (plan) => plan.id === subscription.plan_id,
      ) ?? null
    : null;

  const metadataName =
    typeof selectedAuthUser.user_metadata?.full_name ===
    "string"
      ? selectedAuthUser.user_metadata.full_name.trim()
      : "";

  const displayName =
    profile?.full_name ||
    metadataName ||
    selectedAuthUser.email?.split("@")[0] ||
    "Unnamed member";

  const pageError =
    profileResult.error ??
    scoresResult.error ??
    subscriptionResult.error ??
    plansResult.error;

  return (
    <PageContainer>
      <Link
        href="/admin/members"
        className="font-semibold text-emerald-700 transition hover:text-emerald-900"
      >
        ← Back to members
      </Link>

      <header className="mt-10 rounded-[2rem] bg-slate-950 px-7 py-10 text-white sm:px-10 lg:px-14">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
          Administrator · Member management
        </p>

        <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
          {displayName}
        </h1>

        <p className="mt-4 text-lg text-slate-300">
          {selectedAuthUser.email ?? "No email address"}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold uppercase text-emerald-200">
            {profile?.role ?? "subscriber"}
          </span>

          <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-slate-200">
            Joined{" "}
            {formatDate(
              profile?.created_at ??
                selectedAuthUser.created_at,
            )}
          </span>

          {selectedAuthUser.id === user.id && (
            <span className="rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-amber-950">
              Your account
            </span>
          )}
        </div>
      </header>

      {pageError ? (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          Unable to load member information:{" "}
          {pageError.message}
        </div>
      ) : (
        <>
          <div className="mt-8">
            <MemberSubscriptionManager
              userId={userId}
              initialSubscription={subscription}
              planName={selectedPlan?.name ?? null}
            />
          </div>

          <div className="mt-8">
            <MemberScoreManager
              userId={userId}
              initialScores={scores}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
