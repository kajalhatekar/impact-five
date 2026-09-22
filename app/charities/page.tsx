"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { PageContainer } from "@/app/components/page-container";
import { createClient } from "@/lib/supabase/client";

type Charity = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  website_url: string | null;
  is_featured: boolean;
  category: string;
  upcoming_event: string | null;
  impact_summary: string | null;
};

type CharitySelection = {
  charity_id: string | null;
  charity_name: string | null;
  charity_percentage: number;
};

type Feedback = {
  type: "success" | "error";
  text: string;
} | null;

function CharityImageFallback({
  charity,
  variant = "card",
}: {
  charity: Charity;
  variant?: "featured" | "card";
}) {
  const isFeatured = variant === "featured";
  const summary =
    charity.impact_summary ?? charity.upcoming_event ?? charity.description;
  const titleClasses = isFeatured
    ? "max-w-md text-5xl font-black leading-none text-white sm:text-6xl"
    : "max-w-md text-3xl font-black leading-none text-emerald-950";

  return (
    <div
      className={`relative flex h-full min-h-full overflow-hidden ${
        isFeatured
          ? "bg-[linear-gradient(135deg,#059669,#047857_52%,#064e3b)] p-8 sm:p-10"
          : "bg-[linear-gradient(135deg,#ecfdf5,#bbf7d0_52%,#86efac)] p-5"
      }`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.42),transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/30 to-transparent" />
      {isFeatured && (
        <>
          <div className="absolute -left-20 top-12 h-64 w-64 rounded-full border border-white/20" />
          <div className="absolute -bottom-20 -right-14 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute right-16 top-16 h-4 w-4 rounded-full bg-amber-300 shadow-sm" />
        </>
      )}

      <div
        className={`relative z-10 flex w-full flex-col justify-between ${
          isFeatured ? "min-h-96" : "min-h-28"
        }`}
      >
        <div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
              isFeatured
                ? "bg-white/20 text-white"
                : "bg-white/65 text-emerald-800"
            }`}
          >
            {charity.category}
          </span>
        </div>

        <div>
          <p className={titleClasses}>{charity.name}</p>

          {isFeatured && (
            <p className="mt-5 max-w-sm text-base leading-7 text-emerald-50">
              {summary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CharitiesPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [charities, setCharities] = useState<Charity[]>([]);
  const [selection, setSelection] = useState<CharitySelection | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCharityId, setSelectedCharityId] = useState<string | null>(
    null,
  );
  const [percentage, setPercentage] = useState(10);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let isActive = true;

    async function initialisePage() {
      const [charitiesResult, userResult] = await Promise.all([
        supabase.rpc("get_active_charities"),
        supabase.auth.getUser(),
      ]);

      if (!isActive) {
        return;
      }

      if (charitiesResult.error) {
        setFeedback({
          type: "error",
          text: charitiesResult.error.message,
        });
      } else {
        setCharities((charitiesResult.data as Charity[]) ?? []);
      }

      const currentUser = userResult.data.user;

      if (currentUser) {
        setUserId(currentUser.id);

        const { data, error } = await supabase.rpc(
          "get_my_charity_selection",
        );

        if (!isActive) {
          return;
        }

        if (error) {
          setFeedback({
            type: "error",
            text: error.message,
          });
        } else {
          const currentSelection = (
            data as CharitySelection[] | null
          )?.[0];

          if (currentSelection) {
            setSelection(currentSelection);
            setPercentage(currentSelection.charity_percentage ?? 10);
          }
        }
      }

      setIsLoading(false);
    }

    void initialisePage();

    return () => {
      isActive = false;
    };
  }, [supabase]);

  const categories = useMemo(() => {
    const availableCategories = charities
      .map((charity) => charity.category)
      .filter(Boolean);

    return ["All", ...Array.from(new Set(availableCategories))];
  }, [charities]);

  const filteredCharities = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    return charities.filter((charity) => {
      const matchesCategory =
        selectedCategory === "All" ||
        charity.category === selectedCategory;

      const matchesSearch =
        !normalisedSearch ||
        charity.name.toLowerCase().includes(normalisedSearch) ||
        charity.description.toLowerCase().includes(normalisedSearch) ||
        charity.category.toLowerCase().includes(normalisedSearch) ||
        charity.impact_summary
          ?.toLowerCase()
          .includes(normalisedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [charities, searchTerm, selectedCategory]);

  const featuredCharity =
    charities.find((charity) => charity.is_featured) ?? null;

  function openSelectionForm(charity: Charity) {
    if (!userId) {
      router.push("/login");
      return;
    }

    setSelectedCharityId(charity.id);
    setFeedback(null);

    if (selection?.charity_id === charity.id) {
      setPercentage(selection.charity_percentage);
    } else {
      setPercentage(10);
    }
  }

  function closeSelectionForm() {
    setSelectedCharityId(null);
    setFeedback(null);
  }

  async function saveCharitySelection(charity: Charity) {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (percentage < 10 || percentage > 100) {
      setFeedback({
        type: "error",
        text: "Your charity contribution must be between 10% and 100%.",
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const { error } = await supabase.rpc("select_my_charity", {
      p_charity_id: charity.id,
      p_percentage: percentage,
    });

    if (error) {
      setFeedback({
        type: "error",
        text: error.message,
      });

      setIsSaving(false);
      return;
    }

    setSelection({
      charity_id: charity.id,
      charity_name: charity.name,
      charity_percentage: percentage,
    });

    setSelectedCharityId(null);
    setFeedback({
      type: "success",
      text: `${charity.name} is now receiving ${percentage}% of your subscription contribution.`,
    });
    setIsSaving(false);
  }

  function getCharityImageStyle(
    charity: Charity,
  ): CSSProperties | undefined {
    if (!charity.image_url) {
      return undefined;
    }

    return {
      backgroundImage: `linear-gradient(rgba(4, 47, 38, 0.12), rgba(4, 47, 38, 0.35)), url("${charity.image_url}")`,
    };
  }

  return (
    <PageContainer>
      <section>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Give back
          </p>

          <div className="mt-4 grid gap-7 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Your subscription can create meaningful change.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Choose a cause that matters to you and direct at least 10% of
                your subscription contribution towards its work.
              </p>
            </div>

            {selection?.charity_id && (
              <div className="rounded-3xl bg-emerald-950 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                  Your current impact
                </p>

                <h2 className="mt-3 text-2xl font-bold">
                  {selection.charity_name}
                </h2>

                <p className="mt-3 text-emerald-100">
                  {selection.charity_percentage}% of your subscription is
                  directed to this charity.
                </p>
              </div>
            )}
          </div>
      </section>

      {featuredCharity && (
        <section className="mt-14">
          <div className="overflow-hidden rounded-[2rem] bg-emerald-950 text-white">
            <div className="grid lg:grid-cols-2">
              <div
                role="img"
                aria-label={featuredCharity.name}
                style={getCharityImageStyle(featuredCharity)}
                className={`min-h-72 bg-cover bg-center ${
                  featuredCharity.image_url
                    ? ""
                    : "bg-gradient-to-br from-emerald-500 to-emerald-900"
                }`}
              >
                {!featuredCharity.image_url && (
                  <CharityImageFallback
                    charity={featuredCharity}
                    variant="featured"
                  />
                )}
              </div>

              <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Featured charity spotlight
                </p>

                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                  {featuredCharity.name}
                </h2>

                <p className="mt-5 leading-7 text-emerald-50">
                  {featuredCharity.description}
                </p>

                {featuredCharity.impact_summary && (
                  <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-emerald-100">
                    {featuredCharity.impact_summary}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => openSelectionForm(featuredCharity)}
                  className="mt-7 w-fit rounded-full bg-white px-6 py-3 font-semibold text-emerald-900 transition hover:bg-emerald-100"
                >
                  {selection?.charity_id === featuredCharity.id
                    ? "Update contribution"
                    : "Support this charity"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="-mx-5 mt-16 rounded-3xl border border-slate-200 bg-white px-5 py-14 sm:-mx-8 sm:px-8 sm:py-16">
        <div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                Charity directory
              </p>

              <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Find a cause close to you
              </h2>
            </div>

            <div className="w-full">
              <label
                htmlFor="charity-search"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Search charities
              </label>

              <input
                id="charity-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, cause or impact"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === category
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {feedback && (
            <p
              role={feedback.type === "error" ? "alert" : "status"}
              className={`mt-8 rounded-2xl px-5 py-4 text-sm ${
                feedback.type === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {feedback.text}
            </p>
          )}

          {isLoading ? (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
              Loading charities...
            </div>
          ) : filteredCharities.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 p-12 text-center">
              <p className="font-semibold">No charities found</p>
              <p className="mt-2 text-sm text-slate-500">
                Try a different search term or category.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCharities.map((charity) => {
                const isSelected =
                  selection?.charity_id === charity.id;

                const isChoosing =
                  selectedCharityId === charity.id;

                return (
                  <article
                    key={charity.id}
                    className={`flex h-full flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg ${
                      isSelected
                        ? "border-emerald-500 ring-4 ring-emerald-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div
                      role="img"
                      aria-label={charity.name}
                      style={getCharityImageStyle(charity)}
                      className={`h-36 shrink-0 bg-cover bg-center sm:h-40 ${
                        charity.image_url
                          ? ""
                          : "bg-gradient-to-br from-emerald-100 to-teal-200"
                      }`}
                    >
                      {!charity.image_url && (
                        <CharityImageFallback charity={charity} />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex min-h-7 flex-wrap items-start justify-between gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {charity.category}
                        </span>

                        {isSelected && (
                          <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">
                            Your charity
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 line-clamp-2 text-xl font-bold leading-7">
                        {charity.name}
                      </h3>

                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                        {charity.description}
                      </p>

                      {charity.upcoming_event && (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                            Upcoming event
                          </p>

                          <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-amber-900">
                            {charity.upcoming_event}
                          </p>
                        </div>
                      )}

                      {isChoosing ? (
                        <div className="mt-auto pt-5">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <label
                              htmlFor={`percentage-${charity.id}`}
                              className="block text-sm font-semibold text-slate-800"
                            >
                              Contribution percentage
                            </label>

                            <div className="mt-3 flex items-center gap-3">
                              <input
                                id={`percentage-${charity.id}`}
                                type="range"
                                min={10}
                                max={100}
                                step={5}
                                value={percentage}
                                onChange={(event) =>
                                  setPercentage(
                                    Number(event.target.value),
                                  )
                                }
                                className="w-full accent-emerald-700"
                              />

                              <span className="min-w-14 rounded-lg bg-white px-3 py-2 text-center font-bold text-emerald-800">
                                {percentage}%
                              </span>
                            </div>

                            <p className="mt-2 text-xs text-slate-500">
                              The minimum contribution is 10%.
                            </p>

                            <div className="mt-4 flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void saveCharitySelection(charity)
                                }
                                disabled={isSaving}
                                className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSaving
                                  ? "Saving..."
                                  : "Confirm selection"}
                              </button>

                              <button
                                type="button"
                                onClick={closeSelectionForm}
                                disabled={isSaving}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto flex items-center gap-3 pt-5">
                          <button
                            type="button"
                            onClick={() => openSelectionForm(charity)}
                            className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                          >
                            {isSelected
                              ? `Update ${selection.charity_percentage}%`
                              : "Choose this charity"}
                          </button>

                          {charity.website_url && (
                            <a
                              href={charity.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Visit
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
