import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UpdateWinnerBody = {
  winnerId?: string;
  verificationStatus?: string;
  payoutStatus?: string;
};

const VERIFICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
];

const PAYOUT_STATUSES = [
  "pending",
  "processing",
  "paid",
  "failed",
];

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data: isAdmin,
      error: adminCheckError,
    } = await supabase.rpc("is_admin");

    if (adminCheckError || !isAdmin) {
      return NextResponse.json(
        {
          error: "Administrator access is required.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      (await request.json()) as UpdateWinnerBody;

    const winnerId = body.winnerId?.trim();

    const verificationStatus =
      body.verificationStatus?.trim().toLowerCase();

    const payoutStatus =
      body.payoutStatus?.trim().toLowerCase();

    if (!winnerId) {
      return NextResponse.json(
        {
          error: "Winner information is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      verificationStatus &&
      !VERIFICATION_STATUSES.includes(
        verificationStatus,
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid verification status.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      payoutStatus &&
      !PAYOUT_STATUSES.includes(payoutStatus)
    ) {
      return NextResponse.json(
        {
          error: "Invalid payout status.",
        },
        {
          status: 400,
        },
      );
    }

    if (!verificationStatus && !payoutStatus) {
      return NextResponse.json(
        {
          error: "No winner update was provided.",
        },
        {
          status: 400,
        },
      );
    }

    const admin = createAdminClient();

    const {
      data: winner,
      error: winnerError,
    } = await admin
      .from("draw_winners")
      .select(
        `
          id,
          verification_status,
          payout_status,
          proof_storage_path
        `,
      )
      .eq("id", winnerId)
      .single();

    if (winnerError || !winner) {
      return NextResponse.json(
        {
          error: "Winner record was not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      verificationStatus &&
      verificationStatus !== "pending" &&
      !winner.proof_storage_path
    ) {
      return NextResponse.json(
        {
          error:
            "The winner must submit proof before review.",
        },
        {
          status: 400,
        },
      );
    }

    const effectiveVerificationStatus =
      verificationStatus ??
      winner.verification_status;

    if (
      payoutStatus &&
      payoutStatus !== "pending" &&
      effectiveVerificationStatus !== "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "The proof must be approved before updating the payout.",
        },
        {
          status: 400,
        },
      );
    }

    const now = new Date().toISOString();

    const updateData: {
      verification_status?: string;
      payout_status?: string;
      reviewed_by?: string | null;
      reviewed_at?: string | null;
      paid_at?: string | null;
      updated_at: string;
    } = {
      updated_at: now,
    };

    if (verificationStatus) {
      updateData.verification_status =
        verificationStatus;

      updateData.reviewed_by = user.id;
      updateData.reviewed_at = now;

      if (verificationStatus === "rejected") {
        updateData.payout_status = "pending";
        updateData.paid_at = null;
      }
    }

    if (payoutStatus) {
      updateData.payout_status = payoutStatus;

      updateData.paid_at =
        payoutStatus === "paid" ? now : null;
    }

    const {
      error: updateError,
    } = await admin
      .from("draw_winners")
      .update(updateData)
      .eq("id", winnerId);

    if (updateError) {
      console.error(
        "Winner update failed:",
        updateError,
      );

      return NextResponse.json(
        {
          error: "The winner status could not be updated.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Winner status updated successfully.",
    });
  } catch (error) {
    console.error("Admin winner update error:", error);

    return NextResponse.json(
      {
        error: "Unable to update the winner status.",
      },
      {
        status: 500,
      },
    );
  }
}
