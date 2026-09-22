"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type AdminCharityRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  website_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  upcoming_event: string | null;
  impact_summary: string | null;
};

type CharityManagerProps = {
  initialCharities: AdminCharityRecord[];
};

type CharityApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  charity?: AdminCharityRecord;
};

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

type CharityForm = {
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  websiteUrl: string;
  upcomingEvent: string;
  impactSummary: string;
  isFeatured: boolean;
  isActive: boolean;
};

const emptyForm: CharityForm = {
  name: "",
  description: "",
  category: "Community",
  imageUrl: "",
  websiteUrl: "",
  upcomingEvent: "",
  impactSummary: "",
  isFeatured: false,
  isActive: true,
};

function sortCharities(
  charities: AdminCharityRecord[],
) {
  return [...charities].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

export default function CharityManager({
  initialCharities,
}: CharityManagerProps) {
  const router = useRouter();

  const [charities, setCharities] = useState(
    sortCharities(initialCharities),
  );

  const [form, setForm] =
    useState<CharityForm>(emptyForm);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [feedback, setFeedback] =
    useState<Feedback>(null);

  function updateField<
    Field extends keyof CharityForm,
  >(field: Field, value: CharityForm[Field]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setFeedback(null);
  }

  function startCreating() {
    setForm(emptyForm);
    setEditingId(null);
    setFeedback(null);
    setIsFormOpen(true);
  }

  function startEditing(charity: AdminCharityRecord) {
    setForm({
      name: charity.name,
      description: charity.description,
      category: charity.category,
      imageUrl: charity.image_url ?? "",
      websiteUrl: charity.website_url ?? "",
      upcomingEvent: charity.upcoming_event ?? "",
      impactSummary: charity.impact_summary ?? "",
      isFeatured: charity.is_featured,
      isActive: charity.is_active,
    });

    setEditingId(charity.id);
    setFeedback(null);
    setIsFormOpen(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFeedback(null);
    setIsFormOpen(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFeedback(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/admin/charities",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            charityId: editingId ?? undefined,
            name: form.name,
            description: form.description,
            category: form.category,
            imageUrl: form.imageUrl,
            websiteUrl: form.websiteUrl,
            upcomingEvent: form.upcomingEvent,
            impactSummary: form.impactSummary,
            isFeatured: form.isFeatured,
            isActive: form.isActive,
          }),
        },
      );

      const result =
        (await response.json()) as CharityApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ??
            "Unable to save the charity.",
        );
      }

      if (result.charity) {
        setCharities((currentCharities) => {
          if (editingId) {
            return sortCharities(
              currentCharities.map((charity) =>
                charity.id === result.charity?.id
                  ? result.charity
                  : charity,
              ),
            );
          }

          return sortCharities([
            ...currentCharities,
            result.charity as AdminCharityRecord,
          ]);
        });
      }

      setFeedback({
        type: "success",
        message:
          result.message ??
          "Charity saved successfully.",
      });

      setForm(emptyForm);
      setEditingId(null);
      setIsFormOpen(false);

      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save the charity.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCharity(
    charity: AdminCharityRecord,
  ) {
    const shouldDelete = window.confirm(
      `Permanently delete "${charity.name}"? This cannot be undone.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(charity.id);
    setFeedback(null);

    try {
      const response = await fetch(
        "/api/admin/charities",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            charityId: charity.id,
          }),
        },
      );

      const result =
        (await response.json()) as CharityApiResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ??
            "Unable to delete the charity.",
        );
      }

      setCharities((currentCharities) =>
        currentCharities.filter(
          (item) => item.id !== charity.id,
        ),
      );

      setFeedback({
        type: "success",
        message:
          result.message ??
          "Charity deleted successfully.",
      });

      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete the charity.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Charity directory
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Manage charities
          </h2>

          <p className="mt-2 text-slate-600">
            {charities.length}{" "}
            {charities.length === 1
              ? "charity"
              : "charities"}{" "}
            in the directory
          </p>
        </div>

        <button
          type="button"
          onClick={
            isFormOpen ? closeForm : startCreating
          }
          className="rounded-full bg-emerald-800 px-6 py-3 font-bold text-white transition hover:bg-emerald-900"
        >
          {isFormOpen ? "Close form" : "Add charity"}
        </button>
      </div>

      {feedback && (
        <p
          role={
            feedback.type === "error"
              ? "alert"
              : "status"
          }
          className={`mt-5 rounded-2xl px-5 py-4 font-semibold ${
            feedback.type === "error"
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              {editingId
                ? "Edit charity"
                : "New charity"}
            </p>

            <h3 className="mt-2 text-3xl font-bold text-slate-950">
              {editingId
                ? "Update charity profile"
                : "Create charity profile"}
            </h3>
          </div>

          <div className="mt-7 grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="charity-name"
                className="block text-sm font-semibold text-slate-700"
              >
                Charity name
              </label>

              <input
                id="charity-name"
                type="text"
                required
                maxLength={120}
                disabled={isSaving}
                value={form.name}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="charity-category"
                className="block text-sm font-semibold text-slate-700"
              >
                Category
              </label>

              <input
                id="charity-category"
                type="text"
                required
                maxLength={80}
                disabled={isSaving}
                value={form.category}
                onChange={(event) =>
                  updateField(
                    "category",
                    event.target.value,
                  )
                }
                placeholder="Community, Health, Education..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="charity-description"
                className="block text-sm font-semibold text-slate-700"
              >
                Description
              </label>

              <textarea
                id="charity-description"
                required
                maxLength={2000}
                rows={5}
                disabled={isSaving}
                value={form.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="charity-image"
                className="block text-sm font-semibold text-slate-700"
              >
                Image URL
              </label>

              <input
                id="charity-image"
                type="url"
                disabled={isSaving}
                value={form.imageUrl}
                onChange={(event) =>
                  updateField(
                    "imageUrl",
                    event.target.value,
                  )
                }
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="charity-website"
                className="block text-sm font-semibold text-slate-700"
              >
                Website URL
              </label>

              <input
                id="charity-website"
                type="url"
                disabled={isSaving}
                value={form.websiteUrl}
                onChange={(event) =>
                  updateField(
                    "websiteUrl",
                    event.target.value,
                  )
                }
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="charity-event"
                className="block text-sm font-semibold text-slate-700"
              >
                Upcoming event
              </label>

              <textarea
                id="charity-event"
                maxLength={500}
                rows={3}
                disabled={isSaving}
                value={form.upcomingEvent}
                onChange={(event) =>
                  updateField(
                    "upcomingEvent",
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="charity-impact"
                className="block text-sm font-semibold text-slate-700"
              >
                Impact summary
              </label>

              <textarea
                id="charity-impact"
                maxLength={1000}
                rows={3}
                disabled={isSaving}
                value={form.impactSummary}
                onChange={(event) =>
                  updateField(
                    "impactSummary",
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-5 rounded-2xl bg-slate-50 p-5">
            <label className="flex cursor-pointer items-center gap-3 font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                disabled={isSaving}
                onChange={(event) =>
                  updateField(
                    "isActive",
                    event.target.checked,
                  )
                }
                className="h-5 w-5 accent-emerald-700"
              />

              Active
            </label>

            <label className="flex cursor-pointer items-center gap-3 font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.isFeatured}
                disabled={isSaving}
                onChange={(event) =>
                  updateField(
                    "isFeatured",
                    event.target.checked,
                  )
                }
                className="h-5 w-5 accent-emerald-700"
              />

              Featured on homepage
            </label>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-emerald-800 px-7 py-3 font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Update charity"
                  : "Create charity"}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={closeForm}
              className="rounded-full border border-slate-300 px-7 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {charities.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-950">
            No charities found
          </p>

          <p className="mt-2 text-slate-500">
            Add the first charity to the directory.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {charities.map((charity) => (
            <article
              key={charity.id}
              className={`rounded-3xl border bg-white p-6 shadow-sm ${
                charity.is_active
                  ? "border-slate-200"
                  : "border-amber-200 opacity-75"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
                    {charity.category}
                  </p>

                  <h3 className="mt-2 text-2xl font-bold text-slate-950">
                    {charity.name}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {charity.is_featured && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-800">
                      Featured
                    </span>
                  )}

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      charity.is_active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {charity.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>
              </div>

              <p className="mt-4 leading-7 text-slate-600">
                {charity.description}
              </p>

              {charity.impact_summary && (
                <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Impact
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-900">
                    {charity.impact_summary}
                  </p>
                </div>
              )}

              {charity.upcoming_event && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                    Upcoming event
                  </p>

                  <p className="mt-2 text-sm leading-6 text-blue-900">
                    {charity.upcoming_event}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                {charity.website_url && (
                  <a
                    href={charity.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Visit website ↗
                  </a>
                )}

                {charity.image_url && (
                  <a
                    href={charity.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-slate-600 hover:text-slate-900"
                  >
                    View image ↗
                  </a>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={deletingId !== null}
                  onClick={() => startEditing(charity)}
                  className="rounded-full border border-emerald-700 px-5 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-800 hover:text-white disabled:opacity-50"
                >
                  Edit
                </button>

                <button
                  type="button"
                  disabled={deletingId !== null}
                  onClick={() =>
                    void deleteCharity(charity)
                  }
                  className="rounded-full bg-red-50 px-5 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  {deletingId === charity.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}