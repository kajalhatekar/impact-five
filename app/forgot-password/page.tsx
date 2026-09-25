"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";

import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleResetRequest(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMessage(
      "If an account exists for that email, we sent a password reset link.",
    );
    setIsLoading(false);
  }

  return (
    <main className="flex min-h-[calc(100dvh-98px)] items-center justify-center bg-[#f4f1e9] px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Impact Five
        </p>

        <h1 className="text-3xl font-bold text-slate-950">Reset password</h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Enter your email and we&apos;ll send you a secure link to choose a new
          password.
        </p>

        <form onSubmit={handleResetRequest} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              placeholder="you@example.com"
            />
          </div>

          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                isError
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {isLoading ? "Sending link..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-emerald-700">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}