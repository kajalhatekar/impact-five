"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  containerClassName?: string;
};

/**
 * Reusable password field with a local show/hide toggle.
 *
 * Accepts normal input props while owning the password visibility state, keeping
 * login and signup forms consistent without duplicating credential UI logic.
 */
export function PasswordInput({
  className = "",
  containerClassName = "",
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative ${containerClassName}`}>
      <input
        {...props}
        type={isVisible ? "text" : "password"}
        className={`${className} pr-12`}
      />

      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-700 transition hover:text-emerald-900"
        aria-label={isVisible ? "Hide password" : "Show password"}
      >
        {isVisible ? (
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.1A9.6 9.6 0 0 1 12 5c5 0 9 5 9 7a8.5 8.5 0 0 1-2 3.2" />
            <path d="M6.6 6.6C4.4 8 3 10.4 3 12c0 2 4 7 9 7 1.4 0 2.7-.4 3.9-1" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
