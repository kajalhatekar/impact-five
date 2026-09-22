import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("charities")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Unable to load active charities:", error);

      return NextResponse.json(
        { error: "Unable to load charities." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      charities: data ?? [],
    });
  } catch (error) {
    console.error("Active charity API error:", error);

    return NextResponse.json(
      { error: "Unable to load charities." },
      { status: 500 },
    );
  }
}