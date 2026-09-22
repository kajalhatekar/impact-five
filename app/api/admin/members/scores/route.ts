import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ScoreRequestBody = {
  userId?: string;
  scoreId?: string;
  score?: number;
  playedOn?: string;
};

async function authorizeAdministrator() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      response: NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        },
      ),
    };
  }

  const {
    data: isAdmin,
    error: adminCheckError,
  } = await supabase.rpc("is_admin");

  if (adminCheckError) {
    console.error(
      "Unable to verify administrator:",
      adminCheckError,
    );

    return {
      response: NextResponse.json(
        {
          error: "Unable to verify administrator access.",
        },
        {
          status: 500,
        },
      ),
    };
  }

  if (!isAdmin) {
    return {
      response: NextResponse.json(
        {
          error: "Administrator access is required.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  return {
    admin: createAdminClient(),
  };
}

function validateScoreInput(body: ScoreRequestBody) {
  const userId = body.userId?.trim();
  const scoreId = body.scoreId?.trim();
  const playedOn = body.playedOn?.trim();
  const numericScore = Number(body.score);

  if (!userId) {
    return {
      error: "Member ID is required.",
    };
  }

  if (
    !Number.isInteger(numericScore) ||
    numericScore < 1 ||
    numericScore > 45
  ) {
    return {
      error:
        "The Stableford score must be a whole number between 1 and 45.",
    };
  }

  if (
    !playedOn ||
    !/^\d{4}-\d{2}-\d{2}$/.test(playedOn)
  ) {
    return {
      error: "Please provide a valid played date.",
    };
  }

  const parsedDate = new Date(`${playedOn}T00:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== playedOn
  ) {
    return {
      error: "Please provide a valid played date.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  if (playedOn > today) {
    return {
      error: "The played date cannot be in the future.",
    };
  }

  return {
    userId,
    scoreId,
    score: numericScore,
    playedOn,
  };
}

export async function POST(request: Request) {
  try {
    const authorization =
      await authorizeAdministrator();

    if ("response" in authorization) {
      return authorization.response;
    }

    const body =
      (await request.json()) as ScoreRequestBody;

    const validated = validateScoreInput(body);

    if ("error" in validated) {
      return NextResponse.json(
        {
          error: validated.error,
        },
        {
          status: 400,
        },
      );
    }

    const {
      userId,
      score,
      playedOn,
    } = validated;

    const {
      data: existingScore,
      error: duplicateCheckError,
    } = await authorization.admin
      .from("scores")
      .select("id")
      .eq("user_id", userId)
      .eq("played_on", playedOn)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error(
        "Unable to check existing score:",
        duplicateCheckError,
      );

      return NextResponse.json(
        {
          error: "Unable to validate the score.",
        },
        {
          status: 500,
        },
      );
    }

    if (existingScore) {
      return NextResponse.json(
        {
          error:
            "This member already has a score recorded for that date.",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: createdScore,
      error: createError,
    } = await authorization.admin
      .from("scores")
      .insert({
        user_id: userId,
        score,
        played_on: playedOn,
      })
      .select("id, score, played_on, created_at")
      .single();

    if (createError) {
      console.error(
        "Unable to add member score:",
        createError,
      );

      return NextResponse.json(
        {
          error: `Unable to add the score: ${createError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Keep only the member's latest five scores, matching
     * the normal subscriber score-entry behaviour.
     */
    const {
      data: allScores,
      error: scoresError,
    } = await authorization.admin
      .from("scores")
      .select("id")
      .eq("user_id", userId)
      .order("played_on", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (scoresError) {
      console.error(
        "Unable to enforce latest-five scores:",
        scoresError,
      );
    } else if (allScores && allScores.length > 5) {
      const oldScoreIds = allScores
        .slice(5)
        .map((item) => item.id);

      const {
        error: cleanupError,
      } = await authorization.admin
        .from("scores")
        .delete()
        .in("id", oldScoreIds)
        .eq("user_id", userId);

      if (cleanupError) {
        console.error(
          "Unable to remove old scores:",
          cleanupError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "Score added successfully. Only the latest five scores are retained.",
      score: createdScore,
    });
  } catch (error) {
    console.error("Admin add score error:", error);

    return NextResponse.json(
      {
        error: "Unable to add the score.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authorization =
      await authorizeAdministrator();

    if ("response" in authorization) {
      return authorization.response;
    }

    const body =
      (await request.json()) as ScoreRequestBody;

    const validated = validateScoreInput(body);

    if ("error" in validated) {
      return NextResponse.json(
        {
          error: validated.error,
        },
        {
          status: 400,
        },
      );
    }

    const {
      userId,
      scoreId,
      score,
      playedOn,
    } = validated;

    if (!scoreId) {
      return NextResponse.json(
        {
          error: "Score ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: duplicateScore,
      error: duplicateCheckError,
    } = await authorization.admin
      .from("scores")
      .select("id")
      .eq("user_id", userId)
      .eq("played_on", playedOn)
      .neq("id", scoreId)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error(
        "Unable to check duplicate score:",
        duplicateCheckError,
      );

      return NextResponse.json(
        {
          error: "Unable to validate the score.",
        },
        {
          status: 500,
        },
      );
    }

    if (duplicateScore) {
      return NextResponse.json(
        {
          error:
            "This member already has a score recorded for that date.",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: updatedScore,
      error: updateError,
    } = await authorization.admin
      .from("scores")
      .update({
        score,
        played_on: playedOn,
      })
      .eq("id", scoreId)
      .eq("user_id", userId)
      .select("id, score, played_on, created_at")
      .maybeSingle();

    if (updateError) {
      console.error(
        "Unable to update member score:",
        updateError,
      );

      return NextResponse.json(
        {
          error: `Unable to update the score: ${updateError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    if (!updatedScore) {
      return NextResponse.json(
        {
          error: "The selected score was not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Score updated successfully.",
      score: updatedScore,
    });
  } catch (error) {
    console.error("Admin update score error:", error);

    return NextResponse.json(
      {
        error: "Unable to update the score.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authorization =
      await authorizeAdministrator();

    if ("response" in authorization) {
      return authorization.response;
    }

    const body =
      (await request.json()) as ScoreRequestBody;

    const userId = body.userId?.trim();
    const scoreId = body.scoreId?.trim();

    if (!userId || !scoreId) {
      return NextResponse.json(
        {
          error: "Member ID and score ID are required.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: deletedScore,
      error: deleteError,
    } = await authorization.admin
      .from("scores")
      .delete()
      .eq("id", scoreId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error(
        "Unable to delete member score:",
        deleteError,
      );

      return NextResponse.json(
        {
          error: `Unable to delete the score: ${deleteError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    if (!deletedScore) {
      return NextResponse.json(
        {
          error: "The selected score was not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Score deleted successfully.",
    });
  } catch (error) {
    console.error("Admin delete score error:", error);

    return NextResponse.json(
      {
        error: "Unable to delete the score.",
      },
      {
        status: 500,
      },
    );
  }
}