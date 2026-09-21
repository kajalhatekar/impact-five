import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PublishBody = {
  drawId?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const { data: isAdmin, error: adminCheckError } =
      await supabase.rpc("is_admin");

    if (adminCheckError) {
      console.error("Unable to verify administrator:", adminCheckError);

      return NextResponse.json(
        { error: "Unable to verify administrator access." },
        { status: 500 },
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 },
      );
    }

    const admin = createAdminClient();
    const body = (await request.json()) as PublishBody;
    const drawId = body.drawId?.trim();

    if (!drawId) {
      return NextResponse.json(
        { error: "Draw ID is required." },
        { status: 400 },
      );
    }

    const { data: draw, error: drawError } = await admin
      .from("draws")
      .select("id, status")
      .eq("id", drawId)
      .maybeSingle();

    if (drawError) {
      return NextResponse.json(
        { error: "Unable to load the draw." },
        { status: 500 },
      );
    }

    if (!draw) {
      return NextResponse.json(
        { error: "Draw was not found." },
        { status: 404 },
      );
    }

    if (draw.status === "published") {
      return NextResponse.json({
        success: true,
        message: "This draw is already published.",
      });
    }

    if (draw.status !== "simulated") {
      return NextResponse.json(
        {
          error: "The draw must be simulated before it can be published.",
        },
        { status: 409 },
      );
    }

    const publishedAt = new Date().toISOString();

    const { error: updateError } = await admin
      .from("draws")
      .update({
        status: "published",
        published_at: publishedAt,
        updated_at: publishedAt,
      })
      .eq("id", drawId)
      .eq("status", "simulated");

    if (updateError) {
      console.error("Unable to publish draw:", updateError);

      return NextResponse.json(
        { error: "Unable to publish the draw." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "The monthly draw was published successfully.",
    });
  } catch (error) {
    console.error("Publish draw error:", error);

    return NextResponse.json(
      { error: "Unable to publish the draw." },
      { status: 500 },
    );
  }
}
