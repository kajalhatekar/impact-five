import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/app/components/page-container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CharityDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CharityRecord = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  website_url: string | null;
  is_active: boolean;
  category: string;
  upcoming_event: string | null;
  impact_summary: string | null;
};

type CharitySelection = {
  charity_id: string | null;
  charity_percentage: number | null;
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
 * Public detail page for a single active charity.
 *
 * The page shows richer charity information, highlights the current member's
 * selected percentage when applicable and keeps independent donations separate
 * from subscription contribution selection.
 */
export default async function CharityDetailPage({
  params,
}: CharityDetailPageProps) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("charities")
    .select(
      `
        id,
        name,
        description,
        image_url,
        website_url,
        is_active,
        category,
        upcoming_event,
        impact_summary
      `,
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const charity = data as CharityRecord;
  const websiteUrl = isUsableWebsiteUrl(charity.website_url)
    ? charity.website_url
    : null;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let selectedPercentage: number | null = null;

  if (user) {
    const { data: selectionData } = await supabase.rpc(
      "get_my_charity_selection",
    );

    const selection = (
      selectionData as CharitySelection[] | null
    )?.[0];

    if (selection?.charity_id === charity.id) {
      selectedPercentage = selection.charity_percentage ?? null;
    }
  }

  return (
    <PageContainer>
      <Link
        href="/charities"
        className="font-semibold text-emerald-700 transition hover:text-emerald-900"
      >
        ← Back to charities
      </Link>

      <section className="mt-10 overflow-hidden rounded-[2rem] bg-emerald-950 text-white shadow-sm">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div
            role="img"
            aria-label={charity.name}
            style={
              charity.image_url
                ? {
                    backgroundImage: `linear-gradient(rgba(4, 47, 38, 0.12), rgba(4, 47, 38, 0.42)), url("${charity.image_url}")`,
                  }
                : undefined
            }
            className={`min-h-80 bg-cover bg-center ${
              charity.image_url
                ? ""
                : "bg-[linear-gradient(135deg,#059669,#047857_52%,#064e3b)]"
            }`}
          >
            {!charity.image_url && (
              <div className="relative flex h-full min-h-80 overflow-hidden p-8 sm:p-10">
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.34),transparent_42%)]" />
                <div className="absolute -left-20 top-12 h-64 w-64 rounded-full border border-white/20" />
                <div className="absolute -bottom-20 -right-14 h-56 w-56 rounded-full bg-white/10" />
                <div className="absolute right-16 top-16 h-4 w-4 rounded-full bg-amber-300 shadow-sm" />

                <div className="relative z-10 flex min-h-72 flex-col justify-between">
                  <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
                    {charity.category}
                  </span>

                  <h1 className="max-w-lg text-4xl font-black leading-[1.05] sm:text-5xl">
                    {charity.name}
                  </h1>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              Charity profile
            </p>

            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              {charity.name}
            </h1>

            <p className="mt-5 leading-7 text-emerald-50">
              {charity.description}
            </p>

            {charity.impact_summary && (
              <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-emerald-100">
                {charity.impact_summary}
              </p>
            )}

            {selectedPercentage !== null && (
              <p className="mt-5 w-fit rounded-full bg-emerald-300 px-4 py-2 text-sm font-bold text-emerald-950">
                Your contribution: {selectedPercentage}%
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/charities"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
              >
                Choose or update contribution
              </Link>

              <Link
                href={`/donate?charity=${charity.id}`}
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Donate independently
              </Link>

              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Visit website
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Cause area
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            {charity.category}
          </h2>

          <p className="mt-4 leading-7 text-slate-600">
            Your subscription contribution can support this cause through the
            charity selection flow.
          </p>

          <p className="mt-3 leading-7 text-slate-600">
            You can also donate independently without changing your membership
            or draw eligibility.
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Upcoming event
          </p>

          {charity.upcoming_event ? (
            <p className="mt-3 text-xl font-bold leading-8 text-slate-950">
              {charity.upcoming_event}
            </p>
          ) : (
            <p className="mt-4 leading-7 text-slate-600">
              No upcoming event is listed for this charity yet.
            </p>
          )}
        </article>
      </section>
    </PageContainer>
  );
}
