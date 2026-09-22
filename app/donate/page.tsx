import Link from "next/link";

import { PageContainer } from "@/app/components/page-container";
import { createAdminClient } from "@/lib/supabase/admin";

type DonatePageProps = {
  searchParams: Promise<{
    charity?: string;
  }>;
};

type CharityRecord = {
  id: string;
  name: string;
  description: string;
  website_url: string | null;
  category: string;
  impact_summary: string | null;
};

function isUsableWebsiteUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return !url.hostname.endsWith("example.com");
  } catch {
    return false;
  }
}

/**
 * Public independent-donation route.
 *
 * Donations here send visitors to the charity's own website and intentionally do
 * not affect subscriptions, draw eligibility, score records or contribution
 * percentages inside Impact Five.
 */
export default async function DonatePage({
  searchParams,
}: DonatePageProps) {
  const { charity: selectedCharityId } = await searchParams;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("charities")
    .select(
      `
        id,
        name,
        description,
        website_url,
        category,
        impact_summary
      `,
    )
    .eq("is_active", true)
    .order("name");

  const charities = (data as CharityRecord[] | null) ?? [];
  const selectedCharity =
    charities.find((charity) => charity.id === selectedCharityId) ??
    null;

  return (
    <PageContainer>
      <section className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Independent donation
          </p>

          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Give directly without changing your membership.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            This donation path opens the charity&apos;s own website. It is
            separate from Impact Five subscriptions, score entry, draw
            eligibility and charity contribution percentages.
          </p>
        </div>

        <div className="rounded-3xl bg-emerald-950 p-6 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            No gameplay link
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            Donate as a standalone supporter
          </h2>

          <p className="mt-3 leading-7 text-emerald-100">
            Independent donations do not create memberships, draw entries,
            score records or prize eligibility.
          </p>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700"
        >
          Unable to load charities: {error.message}
        </p>
      )}

      {selectedCharity && (
        <section className="mt-10 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Selected charity
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {selectedCharity.name}
              </h2>

              <p className="mt-2 text-slate-600">
                {selectedCharity.category}
              </p>
            </div>

            {isUsableWebsiteUrl(selectedCharity.website_url) && (
              <a
                href={selectedCharity.website_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-emerald-700 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Donate independently
              </a>
            )}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Charity partners
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Choose where to give
            </h2>
          </div>

          <Link
            href="/charities"
            className="font-semibold text-emerald-700 transition hover:text-emerald-900"
          >
            View charity directory -&gt;
          </Link>
        </div>

        {charities.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No active charities are available right now.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {charities.map((charity) => {
              const websiteUrl = isUsableWebsiteUrl(charity.website_url)
                ? charity.website_url
                : null;
              const isSelected = charity.id === selectedCharityId;

              return (
                <article
                  key={charity.id}
                  className={`flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                    isSelected
                      ? "border-emerald-500 ring-4 ring-emerald-50"
                      : "border-slate-200"
                  }`}
                >
                  <p className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {charity.category}
                  </p>

                  <h3 className="mt-4 text-2xl font-bold">
                    {charity.name}
                  </h3>

                  <p className="mt-3 line-clamp-3 leading-7 text-slate-600">
                    {charity.impact_summary ?? charity.description}
                  </p>

                  <div className="mt-auto grid gap-3 pt-6">
                    {websiteUrl ? (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-800"
                      >
                        Donate independently
                      </a>
                    ) : (
                      <p className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-500">
                        Donation website unavailable
                      </p>
                    )}

                    <Link
                      href={`/charities/${charity.id}`}
                      className="rounded-xl border border-slate-400 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      View charity details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
