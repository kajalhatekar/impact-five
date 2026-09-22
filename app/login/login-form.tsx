"use client";

import { useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/app/components/password-input";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side credential form for Supabase password login.
 *
 * Successful authentication replaces the login route with the dashboard and
 * refreshes server components so the header immediately reflects the session.
 */
export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-[calc(100dvh-98px)] items-center justify-center bg-[#f4f1e9] px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Impact Five
        </p>

        <h1 className="text-3xl font-bold text-slate-950">Welcome back</h1>

        <p className="mt-2 text-sm text-slate-600">
          Sign in to manage your scores and monthly draws.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
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
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-emerald-600"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <PasswordInput
              id="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-emerald-600"
              placeholder="Enter your password"
            />
          </div>

          {message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-emerald-700">
            Create account
          </Link>
        </p>
      </section>
    </main>
  );
}
