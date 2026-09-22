import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";


/**
 * Renders the sign-in route and keeps authenticated users out of the login form.
 *
 * The server-side session check redirects signed-in members to their dashboard,
 * while unauthenticated visitors continue to the credential form.
 */
export default async function LoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
