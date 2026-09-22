import "server-only";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SubscriptionStatus = {
  subscription_status: string | null;
};

export async function getMembershipAccess(
  supabase: ServerSupabaseClient,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      isActive: false,
      error: null,
    };
  }

  const { error: refreshError } = await supabase.rpc(
    "refresh_my_subscription_status",
  );

  if (refreshError) {
    return {
      user,
      isActive: false,
      error: refreshError.message,
    };
  }

  const { data, error: subscriptionError } = await supabase.rpc(
    "get_my_subscription",
  );

  if (subscriptionError) {
    return {
      user,
      isActive: false,
      error: subscriptionError.message,
    };
  }

  const subscriptions =
    (data as SubscriptionStatus[] | null) ?? [];

  const subscriptionStatus =
    subscriptions[0]?.subscription_status ?? "inactive";

  return {
    user,
    isActive: ["active", "trialing"].includes(subscriptionStatus),
    error: null,
  };
}
