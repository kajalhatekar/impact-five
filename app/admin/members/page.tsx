import Link from "next/link";
import { redirect } from "next/navigation";

import { PageContainer } from "@/app/components/page-container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import MemberEditor from "./member-editor";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
};

type SubscriptionRecord = {
  user_id: string;
  plan_id: string | null;
  status: string;
  payment_provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  razorpay_subscription_id: string | null;
  created_at: string;
};

type PlanRecord = {
  id: string;
  code: string;
  name: string;
  price_paise: number;
  currency: string;
  billing_interval: string;
};

type MemberRecord = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  joinedAt: string;
  subscription: SubscriptionRecord | null;
  plan: PlanRecord | null;
};

function formatMoney(amountPaise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(value: string | null) {
  if (!value) {
    return "Not subscribed";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-emerald-100 text-emerald-800";

    case "pending":
    case "authenticated":
      return "bg-amber-100 text-amber-800";

    case "cancelled":
    case "canceled":
    case "halted":
    case "expired":
      return "bg-red-100 text-red-800";

    case "paused":
      return "bg-blue-100 text-blue-800";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function AdminMembersPage() {
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

  const [authUsersResult, profilesResult, subscriptionsResult, plansResult] =
    await Promise.all([
      admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),

      admin.from("profiles").select("id, full_name, role, created_at"),

      admin
        .from("subscriptions")
        .select(
          `
          user_id,
          plan_id,
          status,
          payment_provider,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          razorpay_subscription_id,
          created_at
        `,
        )
        .order("created_at", {
          ascending: false,
        }),

      admin.from("subscription_plans").select(
        `
          id,
          code,
          name,
          price_paise,
          currency,
          billing_interval
        `,
      ),
    ]);

  const pageError =
    authUsersResult.error ??
    profilesResult.error ??
    subscriptionsResult.error ??
    plansResult.error;

  const profiles = (profilesResult.data as ProfileRecord[] | null) ?? [];

  const subscriptions =
    (subscriptionsResult.data as SubscriptionRecord[] | null) ?? [];

  const plans = (plansResult.data as PlanRecord[] | null) ?? [];

  const profileByUserId = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );

  const subscriptionByUserId = new Map<string, SubscriptionRecord>();

  for (const subscription of subscriptions) {
    if (!subscriptionByUserId.has(subscription.user_id)) {
      subscriptionByUserId.set(subscription.user_id, subscription);
    }
  }

  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const members: MemberRecord[] = authUsersResult.data.users
    .map((authUser) => {
      const profile = profileByUserId.get(authUser.id);
      const subscription = subscriptionByUserId.get(authUser.id) ?? null;

      const plan = subscription?.plan_id
        ? (planById.get(subscription.plan_id) ?? null)
        : null;

      const metadataName =
        typeof authUser.user_metadata?.full_name === "string"
          ? authUser.user_metadata.full_name.trim()
          : "";

      return {
        id: authUser.id,
        email: authUser.email ?? "No email",
        fullName:
          profile?.full_name ||
          metadataName ||
          authUser.email?.split("@")[0] ||
          "Unnamed member",
        role: profile?.role ?? "member",
        joinedAt: profile?.created_at ?? authUser.created_at,
        subscription,
        plan,
      };
    })
    .sort(
      (firstMember, secondMember) =>
        new Date(secondMember.joinedAt).getTime() -
        new Date(firstMember.joinedAt).getTime(),
    );

  const activeMemberCount = members.filter((member) =>
    ["active", "trialing"].includes(member.subscription?.status ?? ""),
  ).length;

  const demoSubscriptionCount = members.filter(
    (member) => member.subscription?.payment_provider === "demo",
  ).length;

  const razorpaySubscriptionCount = members.filter(
    (member) => member.subscription?.payment_provider === "razorpay",
  ).length;

  return (
    <PageContainer>
      <Link
        href="/admin"
        className="font-semibold text-emerald-700 transition hover:text-emerald-900"
      >
        ← Back to admin overview
      </Link>

      <div className="mt-10 rounded-[2rem] bg-slate-950 px-7 py-10 text-white sm:px-10 lg:px-14">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
          Administrator
        </p>

        <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
          Members and subscriptions
        </h1>

        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Review registered users, membership plans, subscription status,
          payment providers and renewal dates.
        </p>
      </div>

      {pageError ? (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          Unable to load members: {pageError.message}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <article className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-950 hover:bg-emerald-950 hover:shadow-lg">
              <p className="text-sm font-semibold text-slate-500 transition group-hover:text-emerald-200">
                Registered users
              </p>

              <p className="mt-2 text-4xl font-bold text-slate-950 transition group-hover:text-white">
                {members.length}
              </p>
            </article>

            <article className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-950 hover:bg-emerald-950 hover:shadow-lg">
              <p className="text-sm font-semibold text-slate-500 transition group-hover:text-emerald-200">
                Active memberships
              </p>

              <p className="mt-2 text-4xl font-bold text-emerald-700 transition group-hover:text-white">
                {activeMemberCount}
              </p>
            </article>

            <article className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-950 hover:bg-emerald-950 hover:shadow-lg">
              <p className="text-sm font-semibold text-slate-500 transition group-hover:text-emerald-200">
                Demo subscriptions
              </p>

              <p className="mt-2 text-4xl font-bold text-slate-950 transition group-hover:text-white">
                {demoSubscriptionCount}
              </p>
            </article>

            <article className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-950 hover:bg-emerald-950 hover:shadow-lg">
              <p className="text-sm font-semibold text-slate-500 transition group-hover:text-emerald-200">
                Razorpay subscriptions
              </p>

              <p className="mt-2 text-4xl font-bold text-slate-950 transition group-hover:text-white">
                {razorpaySubscriptionCount}
              </p>
            </article>
          </div>

          <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold">Registered members</h2>

              <p className="mt-2 text-slate-600">
                Subscription information is shown when available.
              </p>
            </div>

            {members.length === 0 ? (
              <p className="border-t border-slate-100 p-8 text-slate-600">
                No registered users were found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-sm text-slate-600">
                    <tr>
                      <th className="px-4 py-4">Member</th>
                      <th className="px-4 py-4">Role</th>
                      <th className="px-4 py-4">Plan</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Payment provider</th>
                      <th className="px-4 py-4">Renewal/end date</th>
                      <th className="px-4 py-4">Joined</th>
                      <th className="px-4 py-4">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td className="px-4 py-5">
                          <p className="font-bold">{member.fullName}</p>

                          <p className="mt-1 text-sm text-slate-500">
                            {member.email}
                          </p>
                        </td>

                        <td className="px-4 py-5">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                            {member.role}
                          </span>
                        </td>

                        <td className="px-4 py-5">
                          {member.plan ? (
                            <>
                              <p className="font-semibold">
                                {member.plan.name}
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {formatMoney(
                                  member.plan.price_paise,
                                  member.plan.currency,
                                )}
                                /
                                {member.plan.billing_interval === "year"
                                  ? "year"
                                  : "month"}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-500">No plan</span>
                          )}
                        </td>

                        <td className="px-4 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${getStatusClasses(
                              member.subscription?.status ?? null,
                            )}`}
                          >
                            {formatStatus(member.subscription?.status ?? null)}
                          </span>

                          {member.subscription?.cancel_at_period_end && (
                            <p className="mt-2 text-xs font-semibold text-amber-700">
                              Cancels at period end
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-5">
                          {member.subscription?.payment_provider ? (
                            <span className="font-semibold capitalize">
                              {member.subscription.payment_provider}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="px-4 py-5 font-semibold">
                          {formatDate(
                            member.subscription?.current_period_end ?? null,
                          )}
                        </td>

                        <td className="px-4 py-5 text-slate-600">
                          {formatDate(member.joinedAt)}
                        </td>

                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col items-start gap-3">
                            <MemberEditor
                              userId={member.id}
                              initialFullName={member.fullName}
                              initialRole={member.role}
                              isCurrentUser={member.id === user.id}
                            />

                            <Link
                              href={`/admin/members/${member.id}`}
                              className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-900"
                            >
                              Manage scores
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
