import Link from "next/link";
import { redirect } from "next/navigation";

import { PageContainer } from "@/app/components/page-container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import CharityManager, {
  type AdminCharityRecord,
} from "./charity-manager";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  selected_charity_id: string | null;
  charity_percentage: number | null;
};

type SubscriptionRecord = {
  user_id: string;
  plan_id: string;
  status: string;
};

type PlanRecord = {
  id: string;
  name: string;
  price_paise: number;
  billing_interval: string;
  currency: string;
};

type ContributionRecord = {
  userId: string;
  userName: string;
  charityName: string;
  charityCategory: string;
  percentage: number;
  planName: string;
  billingInterval: string;
  planPricePaise: number;
  contributionPaise: number;
  monthlyEquivalentPaise: number;
};

function formatMoney(
  amountPaise: number,
  currency = "INR",
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function formatInterval(interval: string) {
  if (interval === "month") {
    return "Monthly";
  }

  if (interval === "year") {
    return "Yearly";
  }

  return interval;
}

/**
 * Admin charity report and management page.
 *
 * Shows contribution analytics alongside the CRUD manager so admins can update
 * charity content and immediately review how active subscriptions allocate funds.
 */
export default async function AdminCharitiesPage() {
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

  const [
    profilesResult,
    charitiesResult,
    subscriptionsResult,
    plansResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        `
          id,
          full_name,
          selected_charity_id,
          charity_percentage
        `,
      )
      .not("selected_charity_id", "is", null),

    admin
      .from("charities")
      .select(
        `
          id,
          name,
          description,
          image_url,
          website_url,
          is_featured,
          is_active,
          created_at,
          category,
          upcoming_event,
          impact_summary
        `,
      )
      .order("name"),

    admin
      .from("subscriptions")
      .select("user_id, plan_id, status")
      .in("status", ["active", "trialing"]),

    admin
      .from("subscription_plans")
      .select(
        `
          id,
          name,
          price_paise,
          billing_interval,
          currency
        `,
      ),
  ]);

  const pageError =
    profilesResult.error ??
    charitiesResult.error ??
    subscriptionsResult.error ??
    plansResult.error;

  const profiles =
    (profilesResult.data as ProfileRecord[] | null) ?? [];

  const charities =
    (charitiesResult.data as
      | AdminCharityRecord[]
      | null) ?? [];

  const subscriptions =
    (subscriptionsResult.data as
      | SubscriptionRecord[]
      | null) ?? [];

  const plans =
    (plansResult.data as PlanRecord[] | null) ?? [];

  const charityById = new Map(
    charities.map((charity) => [charity.id, charity]),
  );

  const subscriptionByUserId = new Map(
    subscriptions.map((subscription) => [
      subscription.user_id,
      subscription,
    ]),
  );

  const planById = new Map(
    plans.map((plan) => [plan.id, plan]),
  );

  const contributions: ContributionRecord[] = profiles
    .map((profile) => {
      if (!profile.selected_charity_id) {
        return null;
      }

      const charity = charityById.get(
        profile.selected_charity_id,
      );

      const subscription = subscriptionByUserId.get(
        profile.id,
      );

      if (!charity || !subscription) {
        return null;
      }

      const plan = planById.get(subscription.plan_id);

      if (!plan) {
        return null;
      }

      const percentage = profile.charity_percentage ?? 0;

      const contributionPaise = Math.round(
        plan.price_paise * (percentage / 100),
      );

      const monthlyEquivalentPaise =
        plan.billing_interval === "year"
          ? Math.round(contributionPaise / 12)
          : contributionPaise;

      return {
        userId: profile.id,
        userName: profile.full_name || "Unnamed member",
        charityName: charity.name,
        charityCategory: charity.category,
        percentage,
        planName: plan.name,
        billingInterval: plan.billing_interval,
        planPricePaise: plan.price_paise,
        contributionPaise,
        monthlyEquivalentPaise,
      };
    })
    .filter(
      (
        contribution,
      ): contribution is ContributionRecord =>
        contribution !== null,
    )
    .sort(
      (firstContribution, secondContribution) =>
        secondContribution.monthlyEquivalentPaise -
        firstContribution.monthlyEquivalentPaise,
    );

  const totalMonthlyEquivalentPaise =
    contributions.reduce(
      (total, contribution) =>
        total + contribution.monthlyEquivalentPaise,
      0,
    );

  const charityTotals = contributions.reduce<
    Map<
      string,
      {
        name: string;
        supporters: number;
        monthlyEquivalentPaise: number;
      }
    >
  >((totals, contribution) => {
    const existing = totals.get(
      contribution.charityName,
    );

    if (existing) {
      existing.supporters += 1;
      existing.monthlyEquivalentPaise +=
        contribution.monthlyEquivalentPaise;
    } else {
      totals.set(contribution.charityName, {
        name: contribution.charityName,
        supporters: 1,
        monthlyEquivalentPaise:
          contribution.monthlyEquivalentPaise,
      });
    }

    return totals;
  }, new Map());

  const charitySummary = [...charityTotals.values()].sort(
    (firstCharity, secondCharity) =>
      secondCharity.monthlyEquivalentPaise -
      firstCharity.monthlyEquivalentPaise,
  );

  return (
    <PageContainer>
        <Link
          href="/admin"
          className="font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Back to admin overview
        </Link>

        <div className="mt-10 rounded-[2rem] bg-emerald-950 px-7 py-10 text-white sm:px-10 lg:px-14">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
            Administrator
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
            Charity contributions
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-100">
            Review active members, their selected causes and
            estimated recurring charity allocations.
          </p>
        </div>

        {pageError ? (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
          >
            Unable to load the charity report:{" "}
            {pageError.message}
          </div>
        ) : (
          <>
            <CharityManager initialCharities={charities} />

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Active contributors
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {contributions.length}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Supported charities
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {charitySummary.length}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
                <p className="text-sm font-semibold text-slate-300">
                  Estimated monthly allocation
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {formatMoney(totalMonthlyEquivalentPaise)}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold">
                Charity summary
              </h2>

              {charitySummary.length === 0 ? (
                <p className="mt-5 text-slate-600">
                  No active subscribers currently have a
                  charity allocation.
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {charitySummary.map((charity) => (
                    <div
                      key={charity.name}
                      className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-bold">
                          {charity.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {charity.supporters} active{" "}
                          {charity.supporters === 1
                            ? "supporter"
                            : "supporters"}
                        </p>
                      </div>

                      <p className="text-xl font-bold text-emerald-700">
                        {formatMoney(
                          charity.monthlyEquivalentPaise,
                        )}
                        /month
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="p-6 sm:p-8">
                <h2 className="text-2xl font-bold">
                  Member allocations
                </h2>

                <p className="mt-2 text-slate-600">
                  Yearly allocations are converted to a monthly
                  equivalent for reporting.
                </p>
              </div>

              {contributions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="bg-slate-100 text-sm text-slate-600">
                      <tr>
                        <th className="px-6 py-4">Member</th>
                        <th className="px-6 py-4">Charity</th>
                        <th className="px-6 py-4">Plan</th>
                        <th className="px-6 py-4">
                          Percentage
                        </th>
                        <th className="px-6 py-4">
                          Allocation
                        </th>
                        <th className="px-6 py-4">
                          Monthly equivalent
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {contributions.map((contribution) => (
                        <tr key={contribution.userId}>
                          <td className="px-6 py-5 font-semibold">
                            {contribution.userName}
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-semibold">
                              {contribution.charityName}
                            </p>

                            {contribution.charityCategory && (
                              <p className="mt-1 text-sm text-slate-500">
                                {
                                  contribution.charityCategory
                                }
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-semibold">
                              {contribution.planName}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {formatInterval(
                                contribution.billingInterval,
                              )}
                            </p>
                          </td>

                          <td className="px-6 py-5 font-bold">
                            {contribution.percentage}%
                          </td>

                          <td className="px-6 py-5">
                            {formatMoney(
                              contribution.contributionPaise,
                            )}
                            /
                            {contribution.billingInterval ===
                            "year"
                              ? "year"
                              : "month"}
                          </td>

                          <td className="px-6 py-5 font-bold text-emerald-700">
                            {formatMoney(
                              contribution.monthlyEquivalentPaise,
                            )}
                            /month
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
