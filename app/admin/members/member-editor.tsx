"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type MemberEditorProps = {
  userId: string;
  initialFullName: string;
  initialRole: string;
  isCurrentUser: boolean;
};

type UpdateMemberResponse = {
  success?: boolean;
  message?: string;
  warning?: string;
  error?: string;
};

/**
 * Inline admin editor for member profile name and role.
 *
 * The current administrator cannot change their own role here, preventing an
 * accidental self-demotion that could remove access to admin controls.
 */
export default function MemberEditor({
  userId,
  initialFullName,
  initialRole,
  isCurrentUser,
}: MemberEditorProps) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] =
    useState(initialFullName);
  const [role, setRole] = useState(
    initialRole === "admin" ? "admin" : "subscriber",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function closeEditor() {
    setFullName(initialFullName);

    setRole(
      initialRole === "admin"
        ? "admin"
        : "subscriber",
    );

    setMessage("");
    setIsError(false);
    setIsEditing(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setIsError(false);

    const normalizedName = fullName.trim();

    if (!normalizedName) {
      setIsError(true);
      setMessage("Full name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/admin/members/update",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            fullName: normalizedName,
            role,
          }),
        },
      );

      const result =
        (await response.json()) as UpdateMemberResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? "Unable to update the member.",
        );
      }

      setIsError(false);
      setMessage(
        result.warning ??
          result.message ??
          "Member updated successfully.",
      );

      router.refresh();

      window.setTimeout(() => {
        setIsEditing(false);
        setMessage("");
      }, 1000);
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the member.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-800 hover:text-white"
      >
        Edit member
      </button>
    );
  }

  return (
    <div className="w-72 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <form onSubmit={handleSubmit}>
        <label
          htmlFor={`member-name-${userId}`}
          className="block text-xs font-bold uppercase tracking-wider text-slate-600"
        >
          Full name
        </label>

        <input
          id={`member-name-${userId}`}
          type="text"
          value={fullName}
          maxLength={100}
          disabled={isSaving}
          onChange={(event) => {
            setFullName(event.target.value);
            setMessage("");
          }}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
        />

        <label
          htmlFor={`member-role-${userId}`}
          className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-600"
        >
          Account role
        </label>

        <select
          id={`member-role-${userId}`}
          value={role}
          disabled={isSaving || isCurrentUser}
          onChange={(event) => {
            setRole(event.target.value);
            setMessage("");
          }}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="subscriber">
            Subscriber
          </option>

          <option value="admin">
            Administrator
          </option>
        </select>

        {isCurrentUser && (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            You cannot change your own administrator role.
          </p>
        )}

        {message && (
          <p
            role={isError ? "alert" : "status"}
            className={`mt-3 text-sm font-semibold ${
              isError
                ? "text-red-700"
                : "text-emerald-700"
            }`}
          >
            {message}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={closeEditor}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
