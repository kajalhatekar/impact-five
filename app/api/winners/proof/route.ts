import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
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
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        },
      );
    }

    const formData = await request.formData();

    const winnerIdValue = formData.get("winnerId");
    const proofValue = formData.get("proof");

    const winnerId =
      typeof winnerIdValue === "string"
        ? winnerIdValue.trim()
        : "";

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

    if (!(proofValue instanceof File)) {
      return NextResponse.json(
        {
          error: "Please select a proof file.",
        },
        {
          status: 400,
        },
      );
    }

    if (proofValue.size === 0) {
      return NextResponse.json(
        {
          error: "The selected file is empty.",
        },
        {
          status: 400,
        },
      );
    }

    if (proofValue.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "The proof file must be smaller than 5 MB.",
        },
        {
          status: 400,
        },
      );
    }

    const extension = ALLOWED_FILE_TYPES[proofValue.type];

    if (!extension) {
      return NextResponse.json(
        {
          error:
            "Only JPG, PNG, WebP and PDF files are allowed.",
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
          user_id,
          verification_status,
          payout_status,
          proof_storage_path
        `,
      )
      .eq("id", winnerId)
      .eq("user_id", user.id)
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

    if (winner.verification_status === "approved") {
      return NextResponse.json(
        {
          error:
            "Your winner verification has already been approved.",
        },
        {
          status: 409,
        },
      );
    }

    if (winner.payout_status === "paid") {
      return NextResponse.json(
        {
          error:
            "Proof cannot be changed after the prize has been paid.",
        },
        {
          status: 409,
        },
      );
    }

    const filePath =
      `${user.id}/${winner.id}/${randomUUID()}.${extension}`;

    const fileBuffer = Buffer.from(
      await proofValue.arrayBuffer(),
    );

    const {
      error: uploadError,
    } = await admin.storage
      .from("winner-proofs")
      .upload(filePath, fileBuffer, {
        contentType: proofValue.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "Winner proof upload failed:",
        uploadError,
      );

      return NextResponse.json(
        {
          error: "The proof file could not be uploaded.",
        },
        {
          status: 500,
        },
      );
    }

    const previousFilePath =
      winner.proof_storage_path;

    const {
      error: updateError,
    } = await admin
      .from("draw_winners")
      .update({
        proof_storage_path: filePath,
        proof_submitted_at: new Date().toISOString(),
        verification_status: "pending",
        payout_status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", winner.id)
      .eq("user_id", user.id);

    if (updateError) {
      await admin.storage
        .from("winner-proofs")
        .remove([filePath]);

      console.error(
        "Winner proof database update failed:",
        updateError,
      );

      return NextResponse.json(
        {
          error:
            "The proof was uploaded, but it could not be saved.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      previousFilePath &&
      previousFilePath !== filePath
    ) {
      const {
        error: removalError,
      } = await admin.storage
        .from("winner-proofs")
        .remove([previousFilePath]);

      if (removalError) {
        console.error(
          "Previous proof removal failed:",
          removalError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "Your proof was uploaded and sent for verification.",
    });
  } catch (error) {
    console.error("Winner proof upload error:", error);

    return NextResponse.json(
      {
        error: "Unable to upload the winner proof.",
      },
      {
        status: 500,
      },
    );
  }
}