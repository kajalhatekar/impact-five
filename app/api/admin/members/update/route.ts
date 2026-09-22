import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type UpdateMemberBody = {
  userId?: string;
  fullName?: string;
  role?: string;
};

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

    const { data: isAdmin, error: adminCheckError } =
      await supabase.rpc("is_admin");

    if (adminCheckError) {
      console.error("Unable to verify administrator:", adminCheckError);

      return NextResponse.json(
        {
          error: "Unable to verify administrator access.",
        },
        {
          status: 500,
        },
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        {
          error: "Administrator access is required.",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as UpdateMemberBody;

    const userId = body.userId?.trim();
    const fullName = body.fullName?.trim();
    const role = body.role?.trim().toLowerCase();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Member ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!fullName) {
      return NextResponse.json(
        {
          error: "Full name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (fullName.length > 100) {
      return NextResponse.json(
        {
          error: "Full name must not exceed 100 characters.",
        },
        {
          status: 400,
        },
      );
    }

    if (role !== "subscriber" && role !== "admin") {
      return NextResponse.json(
        {
          error: "Please select a valid account role.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Prevent the currently signed-in administrator from
     * accidentally removing their own administrator access.
     */
    if (userId === user.id && role !== "admin") {
      return NextResponse.json(
        {
          error: "You cannot remove your own administrator role.",
        },
        {
          status: 400,
        },
      );
    }

    const admin = createAdminClient();

    const { data: updatedProfile, error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        role,
      })
      .eq("id", userId)
      .select("id, full_name, role")
      .maybeSingle();

    if (profileError) {
      console.error("Unable to update member profile:", profileError);

      return NextResponse.json(
        {
          error: `Unable to update the member: ${profileError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    if (!updatedProfile) {
      return NextResponse.json(
        {
          error: "The member profile was not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Keep the authentication metadata synchronized so the
     * updated name also appears in the site header.
     */
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          full_name: fullName,
        },
      },
    );

    if (authUpdateError) {
      console.error(
        "Profile updated, but authentication metadata could not be updated:",
        authUpdateError,
      );

      return NextResponse.json({
        success: true,
        warning:
          "The profile was updated, but the header name may update after the user signs in again.",
        member: updatedProfile,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Member updated successfully.",
      member: updatedProfile,
    });
  } catch (error) {
    console.error("Update member error:", error);

    return NextResponse.json(
      {
        error: "Unable to update the member.",
      },
      {
        status: 500,
      },
    );
  }
}
