import Link from "next/link";
import { redirect } from "next/navigation";

import { PageContainer } from "@/app/components/page-container";
import { PasswordInput } from "@/app/components/password-input";
import { createClient } from "@/lib/supabase/server";

import {
  updatePasswordAction,
  updateProfileAction,
} from "./actions";

type AccountPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AccountPage({
  searchParams,
}: AccountPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  const fullName =
    profile?.full_name ||
    metadataName ||
    user.email?.split("@")[0] ||
    "";

  const successMessage =
    params.success === "profile"
      ? "Your profile has been updated."
      : params.success === "password"
        ? "Your password has been updated."
        : null;

  return (
    <PageContainer>
      <Link
        href="/dashboard"
        className="font-semibold text-emerald-700 transition hover:text-emerald-900"
      >
        ← Back to dashboard
      </Link>

      <section className="mt-10 rounded-[2rem] bg-slate-950 px-7 py-10 text-white sm:px-10 lg:px-14">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
          Your account
        </p>

        <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
          Profile and settings
        </h1>

        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Manage your personal information and keep your account
          secure.
        </p>
      </section>

      {params.error && (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {params.error}
        </div>
      )}

      {profileError && (
        <div
          role="alert"
          className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          Unable to load your profile: {profileError.message}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800"
        >
          {successMessage}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Profile
          </p>

          <h2 className="mt-3 text-3xl font-bold">
            Personal information
          </h2>

          <form
            action={updateProfileAction}
            className="mt-8 space-y-6"
          >
            <div>
              <label
                htmlFor="fullName"
                className="block font-semibold text-slate-800"
              >
                Full name
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                minLength={2}
                maxLength={80}
                defaultValue={fullName}
                autoComplete="name"
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block font-semibold text-slate-800"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                value={user.email ?? ""}
                readOnly
                className="mt-2 w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
              />

              <p className="mt-2 text-sm text-slate-500">
                Your login email cannot be changed here.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-emerald-700 px-6 py-3 font-bold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            >
              Save profile
            </button>
          </form>
        </section>

        <div className="space-y-8">
          <section className="rounded-[2rem] bg-emerald-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
              Account details
            </p>

            <dl className="mt-6 space-y-5">
              <div>
                <dt className="text-sm text-emerald-200">
                  Account role
                </dt>

                <dd className="mt-1 text-xl font-bold capitalize">
                  {profile?.role ?? "subscriber"}
                </dd>
              </div>

              <div className="border-t border-emerald-800 pt-5">
                <dt className="text-sm text-emerald-200">
                  Member since
                </dt>

                <dd className="mt-1 text-xl font-bold">
                  {formatDate(
                    profile?.created_at ?? user.created_at,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
              Security
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Change password
            </h2>

            <form
              action={updatePasswordAction}
              className="mt-8 space-y-6"
            >
              <div>
                <label
                  htmlFor="password"
                  className="block font-semibold text-slate-800"
                >
                  New password
                </label>

                <PasswordInput
                  id="password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  containerClassName="mt-2"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block font-semibold text-slate-800"
                >
                  Confirm new password
                </label>

                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  containerClassName="mt-2"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-full border border-emerald-700 px-6 py-3 font-bold text-emerald-700 transition hover:bg-emerald-700 hover:text-white focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                Update password
              </button>
            </form>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
