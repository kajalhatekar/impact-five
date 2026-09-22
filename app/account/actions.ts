"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Updates the signed-in user's profile name from the account page.
 *
 * Redirect responses carry validation or success messages back to the page,
 * while revalidation refreshes dashboard/header displays that show the name.
 */
export async function updateProfileAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (fullName.length < 2) {
    redirect(
      "/account?error=Full name must contain at least 2 characters.",
    );
  }

  if (fullName.length > 80) {
    redirect(
      "/account?error=Full name cannot exceed 80 characters.",
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
    })
    .eq("id", user.id);

  if (profileError) {
    redirect(
      `/account?error=${encodeURIComponent(
        profileError.message,
      )}`,
    );
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");

  redirect("/account?success=profile");
}

/**
 * Updates the signed-in user's Supabase password.
 *
 * Password confirmation is checked server-side before calling Supabase Auth so
 * the account page can use a simple form without exposing client-only logic.
 */
export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(
    formData.get("confirmPassword") ?? "",
  );

  if (password.length < 8) {
    redirect(
      "/account?error=Password must contain at least 8 characters.",
    );
  }

  if (password !== confirmPassword) {
    redirect("/account?error=Passwords do not match.");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { error: passwordError } =
    await supabase.auth.updateUser({
      password,
    });

  if (passwordError) {
    redirect(
      `/account?error=${encodeURIComponent(
        passwordError.message,
      )}`,
    );
  }

  redirect("/account?success=password");
}
