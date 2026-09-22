"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SyntheticEvent } from "react";

import { PasswordInput } from "@/app/components/password-input";
import { createClient } from "@/lib/supabase/client";

type CharityOption = {
  id: string;
  name: string;
  category: string;
};

/**
 * Account creation flow for new subscribers.
 *
 * Signup also captures the initial charity and contribution percentage so the
 * profile can be prepared before the member chooses a paid subscription plan.
 */
export default function SignupPage() {
  const router = useRouter();

  const [supabase] = useState(() => createClient());

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [charities, setCharities] = useState<CharityOption[]>([]);

  const [selectedCharityId, setSelectedCharityId] = useState("");

  const [charityPercentage, setCharityPercentage] = useState("10");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoadingCharities, setIsLoadingCharities] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCharities() {
      setIsLoadingCharities(true);
      setMessage("");

      try {
        const response = await fetch("/api/charities/active", {
          cache: "no-store",
        });

        const result = (await response.json()) as {
          charities?: CharityOption[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load charities.");
        }

        if (isMounted) {
          setCharities(result.charities ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load charities.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCharities(false);
        }
      }
    }

    void loadCharities();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSignup(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsError(false);

    const normalizedName = fullName.trim();
    const percentage = Number(charityPercentage);

    if (!normalizedName) {
      setIsError(true);
      setMessage("Please enter your full name.");
      return;
    }

    if (!selectedCharityId) {
      setIsError(true);
      setMessage("Please select the charity you want to support.");
      return;
    }

    if (!Number.isInteger(percentage) || percentage < 10 || percentage > 100) {
      setIsError(true);
      setMessage("Charity contribution must be between 10% and 100%.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        /*
         * The database signup trigger reads these values to seed the member's
         * profile and charity contribution immediately after auth user creation.
         */
        data: {
          full_name: normalizedName,
          selected_charity_id: selectedCharityId,
          charity_percentage: percentage,
        },
      },
    });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    if (!data.user) {
      setIsError(true);
      setMessage("The account could not be created. Please try again.");
      setIsLoading(false);
      return;
    }

    setIsError(false);
    setIsLoading(false);

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setMessage(
      "Account created successfully. Please check your email and then sign in.",
    );

    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-[calc(100dvh-69px)] items-center justify-center bg-[#f4f1e9] px-4 py-12">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Impact Five
        </p>

        <h1 className="text-3xl font-bold text-slate-950">
          Create your account
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Track your scores, enter monthly draws and direct part of your
          membership towards a cause you choose.
        </p>

        <form onSubmit={handleSignup} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Full name
            </label>

            <input
              id="fullName"
              type="text"
              required
              maxLength={100}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              placeholder="Enter your full name"
            />
          </div>

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
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              placeholder="Minimum 6 characters"
            />
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-800">
              Choose your cause
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-900">
              At least 10% of your membership contribution will support your
              selected charity.
            </p>

            <label
              htmlFor="charity"
              className="mt-5 block text-sm font-semibold text-slate-700"
            >
              Charity
            </label>

            <select
              id="charity"
              required
              disabled={isLoadingCharities || charities.length === 0}
              value={selectedCharityId}
              onChange={(event) => setSelectedCharityId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                {isLoadingCharities
                  ? "Loading charities..."
                  : "Select a charity"}
              </option>

              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name} · {charity.category}
                </option>
              ))}
            </select>

            <label
              htmlFor="charityPercentage"
              className="mt-5 block text-sm font-semibold text-slate-700"
            >
              Contribution percentage
            </label>

            <div className="mt-2 flex items-center gap-3">
              <input
                id="charityPercentage"
                type="number"
                required
                min={10}
                max={100}
                step={1}
                value={charityPercentage}
                onChange={(event) => setCharityPercentage(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />

              <span className="text-lg font-bold text-emerald-800">%</span>
            </div>
          </div>

          {message && (
            <p
              role={isError ? "alert" : "status"}
              className={`rounded-lg px-3 py-2 text-sm ${
                isError
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || isLoadingCharities || charities.length === 0}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-emerald-700">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
