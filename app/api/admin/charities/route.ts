import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CharityRequestBody = {
  charityId?: string;
  name?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  websiteUrl?: string;
  upcomingEvent?: string;
  impactSummary?: string;
  isFeatured?: boolean;
  isActive?: boolean;
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

function optionalText(value: string | undefined) {
  const normalizedValue = value?.trim() ?? "";

  return normalizedValue || null;
}

function isValidWebUrl(value: string | null) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function validateCharity(body: CharityRequestBody) {
  const name = body.name?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  const category = body.category?.trim() ?? "";

  const imageUrl = optionalText(body.imageUrl);
  const websiteUrl = optionalText(body.websiteUrl);
  const upcomingEvent = optionalText(
    body.upcomingEvent,
  );
  const impactSummary = optionalText(
    body.impactSummary,
  );

  if (!name) {
    return {
      error: "Charity name is required.",
    };
  }

  if (name.length > 120) {
    return {
      error:
        "Charity name must not exceed 120 characters.",
    };
  }

  if (!description) {
    return {
      error: "Charity description is required.",
    };
  }

  if (description.length > 2000) {
    return {
      error:
        "Description must not exceed 2,000 characters.",
    };
  }

  if (!category) {
    return {
      error: "Charity category is required.",
    };
  }

  if (category.length > 80) {
    return {
      error:
        "Category must not exceed 80 characters.",
    };
  }

  if (!isValidWebUrl(imageUrl)) {
    return {
      error:
        "Image URL must begin with http:// or https://.",
    };
  }

  if (!isValidWebUrl(websiteUrl)) {
    return {
      error:
        "Website URL must begin with http:// or https://.",
    };
  }

  if (
    upcomingEvent &&
    upcomingEvent.length > 500
  ) {
    return {
      error:
        "Upcoming event must not exceed 500 characters.",
    };
  }

  if (
    impactSummary &&
    impactSummary.length > 1000
  ) {
    return {
      error:
        "Impact summary must not exceed 1,000 characters.",
    };
  }

  return {
    name,
    description,
    category,
    imageUrl,
    websiteUrl,
    upcomingEvent,
    impactSummary,
    isFeatured: body.isFeatured === true,
    isActive: body.isActive !== false,
  };
}

const charitySelection = `
  id,
  name,
  description,
  image_url,
  website_url,
  is_featured,
  is_active,
  created_at,
  category,
  upcoming_event,
  impact_summary
`;

export async function POST(request: Request) {
  try {
    const authorization =
      await authorizeAdministrator();

    if ("response" in authorization) {
      return authorization.response;
    }

    const body =
      (await request.json()) as CharityRequestBody;

    const validated = validateCharity(body);

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
      data: existingCharity,
      error: duplicateCheckError,
    } = await authorization.admin
      .from("charities")
      .select("id")
      .ilike("name", validated.name)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error(
        "Unable to check duplicate charity:",
        duplicateCheckError,
      );

      return NextResponse.json(
        {
          error: "Unable to validate the charity.",
        },
        {
          status: 500,
        },
      );
    }

    if (existingCharity) {
      return NextResponse.json(
        {
          error:
            "A charity with this name already exists.",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: charity,
      error: createError,
    } = await authorization.admin
      .from("charities")
      .insert({
        name: validated.name,
        description: validated.description,
        category: validated.category,
        image_url: validated.imageUrl,
        website_url: validated.websiteUrl,
        upcoming_event: validated.upcomingEvent,
        impact_summary: validated.impactSummary,
        is_featured: validated.isFeatured,
        is_active: validated.isActive,
      })
      .select(charitySelection)
      .single();

    if (createError) {
      console.error(
        "Unable to create charity:",
        createError,
      );

      return NextResponse.json(
        {
          error: `Unable to create the charity: ${createError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Charity created successfully.",
      charity,
    });
  } catch (error) {
    console.error("Create charity error:", error);

    return NextResponse.json(
      {
        error: "Unable to create the charity.",
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
      (await request.json()) as CharityRequestBody;

    const charityId = body.charityId?.trim();

    if (!charityId) {
      return NextResponse.json(
        {
          error: "Charity ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const validated = validateCharity(body);

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
      data: duplicateCharity,
      error: duplicateCheckError,
    } = await authorization.admin
      .from("charities")
      .select("id")
      .ilike("name", validated.name)
      .neq("id", charityId)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error(
        "Unable to check duplicate charity:",
        duplicateCheckError,
      );

      return NextResponse.json(
        {
          error: "Unable to validate the charity.",
        },
        {
          status: 500,
        },
      );
    }

    if (duplicateCharity) {
      return NextResponse.json(
        {
          error:
            "Another charity already uses this name.",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: charity,
      error: updateError,
    } = await authorization.admin
      .from("charities")
      .update({
        name: validated.name,
        description: validated.description,
        category: validated.category,
        image_url: validated.imageUrl,
        website_url: validated.websiteUrl,
        upcoming_event: validated.upcomingEvent,
        impact_summary: validated.impactSummary,
        is_featured: validated.isFeatured,
        is_active: validated.isActive,
      })
      .eq("id", charityId)
      .select(charitySelection)
      .maybeSingle();

    if (updateError) {
      console.error(
        "Unable to update charity:",
        updateError,
      );

      return NextResponse.json(
        {
          error: `Unable to update the charity: ${updateError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    if (!charity) {
      return NextResponse.json(
        {
          error: "The selected charity was not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Charity updated successfully.",
      charity,
    });
  } catch (error) {
    console.error("Update charity error:", error);

    return NextResponse.json(
      {
        error: "Unable to update the charity.",
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
      (await request.json()) as CharityRequestBody;

    const charityId = body.charityId?.trim();

    if (!charityId) {
      return NextResponse.json(
        {
          error: "Charity ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Do not delete a charity that members currently use.
     * The admin can mark it inactive instead.
     */
    const {
      count: supporterCount,
      error: supporterCheckError,
    } = await authorization.admin
      .from("profiles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("selected_charity_id", charityId);

    if (supporterCheckError) {
      console.error(
        "Unable to check charity supporters:",
        supporterCheckError,
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify whether the charity is currently in use.",
        },
        {
          status: 500,
        },
      );
    }

    if ((supporterCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "This charity is selected by one or more members. Mark it inactive instead of deleting it.",
        },
        {
          status: 409,
        },
      );
    }

    const {
      data: deletedCharity,
      error: deleteError,
    } = await authorization.admin
      .from("charities")
      .delete()
      .eq("id", charityId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error(
        "Unable to delete charity:",
        deleteError,
      );

      return NextResponse.json(
        {
          error: `Unable to delete the charity: ${deleteError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    if (!deletedCharity) {
      return NextResponse.json(
        {
          error: "The selected charity was not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Charity deleted successfully.",
    });
  } catch (error) {
    console.error("Delete charity error:", error);

    return NextResponse.json(
      {
        error: "Unable to delete the charity.",
      },
      {
        status: 500,
      },
    );
  }
}