import { randomInt } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRIZE_POOL_PERCENTAGE = 20;

type SimulationBody = {
  drawMonth?: string;
  drawMode?: "random" | "weighted";
};

type SubscriptionRow = {
  user_id: string;
  plan_id: string;
  current_period_end: string | null;
};

type PlanRow = {
  id: string;
  price_paise: number;
  billing_interval: string;
};

type ProfileRow = {
  id: string;
  selected_charity_id: string | null;
};

type ScoreRow = {
  id: string;
  user_id: string;
  score: number;
  played_on: string;
  created_at: string;
};

type SimulatedEntry = {
  user_id: string;
  score_numbers: number[];
  match_count: number;
};

type SavedEntry = {
  id: string;
  user_id: string;
  match_count: number;
};

function isValidDrawMonth(value: string) {
  if (!/^\d{4}-\d{2}-01$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function generateRandomNumbers() {
  const availableNumbers = Array.from({ length: 45 }, (_, index) => index + 1);

  const selectedNumbers: number[] = [];

  while (selectedNumbers.length < 5) {
    const selectedIndex = randomInt(availableNumbers.length);

    const [selectedNumber] = availableNumbers.splice(selectedIndex, 1);

    selectedNumbers.push(selectedNumber);
  }

  return selectedNumbers.sort(
    (firstNumber, secondNumber) => firstNumber - secondNumber,
  );
}

function generateWeightedNumbers(scoreCollections: number[][]) {
  const scoreFrequency = new Map<number, number>();

  for (const scores of scoreCollections) {
    for (const score of scores) {
      scoreFrequency.set(score, (scoreFrequency.get(score) ?? 0) + 1);
    }
  }

  const availableNumbers = Array.from({ length: 45 }, (_, index) => {
    const number = index + 1;

    return {
      number,
      /*
       * Every number receives a base weight of one.
       * Frequently recorded scores receive additional weight.
       */
      weight: 1 + (scoreFrequency.get(number) ?? 0),
    };
  });

  const selectedNumbers: number[] = [];

  while (selectedNumbers.length < 5 && availableNumbers.length > 0) {
    const totalWeight = availableNumbers.reduce(
      (total, item) => total + item.weight,
      0,
    );

    let selectedWeight = randomInt(totalWeight);
    let selectedIndex = 0;

    for (let index = 0; index < availableNumbers.length; index += 1) {
      selectedWeight -= availableNumbers[index].weight;

      if (selectedWeight < 0) {
        selectedIndex = index;
        break;
      }
    }

    const [selectedItem] = availableNumbers.splice(selectedIndex, 1);

    selectedNumbers.push(selectedItem.number);
  }

  return selectedNumbers.sort(
    (firstNumber, secondNumber) => firstNumber - secondNumber,
  );
}

function calculateMatchCount(scores: number[], winningNumbers: number[]) {
  const uniqueScores = new Set(scores);

  return winningNumbers.filter((winningNumber) =>
    uniqueScores.has(winningNumber),
  ).length;
}

function getMonthlyPlanValue(plan: PlanRow) {
  if (plan.billing_interval === "year") {
    return plan.price_paise / 12;
  }

  return plan.price_paise;
}

function calculatePrizePool(
  subscriptions: SubscriptionRow[],
  plansById: Map<string, PlanRow>,
) {
  return subscriptions.reduce((totalPool, subscription) => {
    const plan = plansById.get(subscription.plan_id);

    if (!plan) {
      return totalPool;
    }

    const monthlyPlanValue = getMonthlyPlanValue(plan);

    const contribution = Math.round(
      monthlyPlanValue * (PRIZE_POOL_PERCENTAGE / 100),
    );

    return totalPool + contribution;
  }, 0);
}

function allocateTierPrizes(entries: SavedEntry[], totalPrizePaise: number) {
  if (entries.length === 0) {
    return [];
  }

  const basePrize = Math.floor(totalPrizePaise / entries.length);

  const remainder = totalPrizePaise % entries.length;

  return entries.map((entry, index) => ({
    entry,
    prizePaise: basePrize + (index < remainder ? 1 : 0),
  }));
}

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

    const body = (await request.json()) as SimulationBody;

    const drawMonth = body.drawMonth?.trim();
    const drawMode = body.drawMode ?? "random";

    if (!drawMonth || !isValidDrawMonth(drawMonth)) {
      return NextResponse.json(
        {
          error:
            "Draw month must be the first day of a month, for example 2026-09-01.",
        },
        {
          status: 400,
        },
      );
    }

    if (drawMode !== "random" && drawMode !== "weighted") {
      return NextResponse.json(
        {
          error: "Draw mode must be random or weighted.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: existingDraw, error: existingDrawError } = await admin
      .from("draws")
      .select("id, status")
      .eq("draw_month", drawMonth)
      .maybeSingle();

    if (existingDrawError) {
      console.error("Unable to check existing draw:", existingDrawError);

      return NextResponse.json(
        {
          error: "Unable to check the existing draw.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      existingDraw?.status === "published" ||
      existingDraw?.status === "closed"
    ) {
      return NextResponse.json(
        {
          error: "A published or closed draw cannot be simulated again.",
        },
        {
          status: 409,
        },
      );
    }

    const currentTime = new Date().toISOString();

    const { data: subscriptionData, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("user_id, plan_id, current_period_end")
      .in("status", ["active", "trialing"])
      .gt("current_period_end", currentTime);

    if (subscriptionError) {
      console.error("Unable to load active subscriptions:", subscriptionError);

      return NextResponse.json(
        {
          error: "Unable to load active subscriptions.",
        },
        {
          status: 500,
        },
      );
    }

    const activeSubscriptions =
      (subscriptionData as SubscriptionRow[] | null) ?? [];

    if (activeSubscriptions.length === 0) {
      return NextResponse.json(
        {
          error: "There are no active subscribers for this draw.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: planData, error: planError } = await admin
      .from("subscription_plans")
      .select("id, price_paise, billing_interval")
      .eq("is_active", true);

    if (planError) {
      console.error("Unable to load subscription plans:", planError);

      return NextResponse.json(
        {
          error: "Unable to load subscription plans.",
        },
        {
          status: 500,
        },
      );
    }

    const plans = (planData as PlanRow[] | null) ?? [];

    const plansById = new Map(plans.map((plan) => [plan.id, plan]));

    const activeUserIds = [
      ...new Set(
        activeSubscriptions.map((subscription) => subscription.user_id),
      ),
    ];

    const { data: profileData, error: profileError } = await admin
      .from("profiles")
      .select("id, selected_charity_id")
      .in("id", activeUserIds);

    if (profileError) {
      console.error("Unable to load subscriber profiles:", profileError);

      return NextResponse.json(
        {
          error: "Unable to load subscriber charity selections.",
        },
        {
          status: 500,
        },
      );
    }

    const profiles = (profileData as ProfileRow[] | null) ?? [];

    const usersWithCharity = new Set(
      profiles
        .filter((profile) => profile.selected_charity_id !== null)
        .map((profile) => profile.id),
    );

    const { data: scoreData, error: scoreError } = await admin
      .from("scores")
      .select("id, user_id, score, played_on, created_at")
      .in("user_id", activeUserIds)
      .order("played_on", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (scoreError) {
      console.error("Unable to load subscriber scores:", scoreError);

      return NextResponse.json(
        {
          error: "Unable to load subscriber scores.",
        },
        {
          status: 500,
        },
      );
    }

    const scores = (scoreData as ScoreRow[] | null) ?? [];

    const scoresByUser = new Map<string, number[]>();

    for (const scoreRecord of scores) {
      const userScores = scoresByUser.get(scoreRecord.user_id) ?? [];

      if (userScores.length < 5) {
        userScores.push(scoreRecord.score);

        scoresByUser.set(scoreRecord.user_id, userScores);
      }
    }

    const eligibleUserScores = new Map<string, number[]>();

    for (const userId of activeUserIds) {
      const latestScores = scoresByUser.get(userId) ?? [];

      if (usersWithCharity.has(userId) && latestScores.length === 5) {
        eligibleUserScores.set(userId, latestScores);
      }
    }

    const scoreCollections = [...eligibleUserScores.values()];

    const winningNumbers =
      drawMode === "weighted"
        ? generateWeightedNumbers(scoreCollections)
        : generateRandomNumbers();

    const simulatedEntries: SimulatedEntry[] = [
      ...eligibleUserScores.entries(),
    ].map(([userId, scoreNumbers]) => ({
      user_id: userId,
      score_numbers: scoreNumbers,
      match_count: calculateMatchCount(scoreNumbers, winningNumbers),
    }));

    const poolTotalPaise = calculatePrizePool(activeSubscriptions, plansById);

    const fiveMatchBasePool = Math.floor(poolTotalPaise * 0.4);

    const fourMatchPool = Math.floor(poolTotalPaise * 0.35);

    const threeMatchPool = poolTotalPaise - fiveMatchBasePool - fourMatchPool;

    const { data: previousDraw, error: previousDrawError } = await admin
      .from("draws")
      .select("jackpot_carried_forward_paise")
      .lt("draw_month", drawMonth)
      .in("status", ["published", "closed"])
      .order("draw_month", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (previousDrawError) {
      console.error("Unable to load previous jackpot:", previousDrawError);

      return NextResponse.json(
        {
          error: "Unable to calculate the jackpot rollover.",
        },
        {
          status: 500,
        },
      );
    }

    const jackpotBroughtForward = Number(
      previousDraw?.jackpot_carried_forward_paise ?? 0,
    );

    const fiveMatchWinnerCount = simulatedEntries.filter(
      (entry) => entry.match_count === 5,
    ).length;

    const fiveMatchAvailablePool = fiveMatchBasePool + jackpotBroughtForward;

    const jackpotCarriedForward =
      fiveMatchWinnerCount === 0 ? fiveMatchAvailablePool : 0;

    const updatedAt = new Date().toISOString();

    const { data: savedDraw, error: saveDrawError } = await admin
      .from("draws")
      .upsert(
        {
          draw_month: drawMonth,
          status: "simulated",
          draw_mode: drawMode,
          winning_numbers: winningNumbers,
          active_subscriber_count: activeSubscriptions.length,
          pool_total_paise: poolTotalPaise,
          five_match_pool_paise: fiveMatchBasePool,
          four_match_pool_paise: fourMatchPool,
          three_match_pool_paise: threeMatchPool,
          jackpot_brought_forward_paise: jackpotBroughtForward,
          jackpot_carried_forward_paise: jackpotCarriedForward,
          created_by: user.id,
          simulated_at: updatedAt,
          published_at: null,
          updated_at: updatedAt,
        },
        {
          onConflict: "draw_month",
        },
      )
      .select("id")
      .single();

    if (saveDrawError || !savedDraw) {
      console.error("Unable to save draw simulation:", saveDrawError);

      return NextResponse.json(
        {
          error: "Unable to save the draw simulation.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Re-simulation replaces entries belonging only
     * to this draft/simulated draw.
     */
    const { error: deleteEntriesError } = await admin
      .from("draw_entries")
      .delete()
      .eq("draw_id", savedDraw.id);

    if (deleteEntriesError) {
      console.error("Unable to reset draw entries:", deleteEntriesError);

      return NextResponse.json(
        {
          error: "Unable to reset the previous simulation.",
        },
        {
          status: 500,
        },
      );
    }

    let savedEntries: SavedEntry[] = [];

    if (simulatedEntries.length > 0) {
      const { data: insertedEntries, error: insertEntriesError } = await admin
        .from("draw_entries")
        .insert(
          simulatedEntries.map((entry) => ({
            draw_id: savedDraw.id,
            user_id: entry.user_id,
            score_numbers: entry.score_numbers,
            match_count: entry.match_count,
          })),
        )
        .select("id, user_id, match_count");

      if (insertEntriesError) {
        console.error("Unable to save draw entries:", insertEntriesError);

        return NextResponse.json(
          {
            error: "Unable to save eligible draw entries.",
          },
          {
            status: 500,
          },
        );
      }

      savedEntries = (insertedEntries as SavedEntry[] | null) ?? [];
    }

    const fiveMatchEntries = savedEntries.filter(
      (entry) => entry.match_count === 5,
    );

    const fourMatchEntries = savedEntries.filter(
      (entry) => entry.match_count === 4,
    );

    const threeMatchEntries = savedEntries.filter(
      (entry) => entry.match_count === 3,
    );

    const winnerAllocations = [
      ...allocateTierPrizes(fiveMatchEntries, fiveMatchAvailablePool),
      ...allocateTierPrizes(fourMatchEntries, fourMatchPool),
      ...allocateTierPrizes(threeMatchEntries, threeMatchPool),
    ];

    if (winnerAllocations.length > 0) {
      const { error: winnerError } = await admin.from("draw_winners").insert(
        winnerAllocations.map(({ entry, prizePaise }) => ({
          draw_id: savedDraw.id,
          entry_id: entry.id,
          user_id: entry.user_id,
          match_count: entry.match_count,
          prize_paise: prizePaise,
          verification_status: "pending",
          payout_status: "pending",
        })),
      );

      if (winnerError) {
        console.error("Unable to save draw winners:", winnerError);

        return NextResponse.json(
          {
            error: "The draw was simulated, but winners could not be saved.",
          },
          {
            status: 500,
          },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Monthly draw simulated successfully.",
      draw: {
        id: savedDraw.id,
        drawMonth,
        drawMode,
        winningNumbers,
        activeSubscriberCount: activeSubscriptions.length,
        eligibleEntryCount: simulatedEntries.length,
        poolTotalPaise,
        tiers: {
          fiveMatch: {
            basePoolPaise: fiveMatchBasePool,
            jackpotBroughtForwardPaise: jackpotBroughtForward,
            availablePoolPaise: fiveMatchAvailablePool,
            winnerCount: fiveMatchEntries.length,
            carriedForwardPaise: jackpotCarriedForward,
          },
          fourMatch: {
            poolPaise: fourMatchPool,
            winnerCount: fourMatchEntries.length,
          },
          threeMatch: {
            poolPaise: threeMatchPool,
            winnerCount: threeMatchEntries.length,
          },
        },
      },
    });
  } catch (error) {
    console.error("Draw simulation error:", error);

    return NextResponse.json(
      {
        error: "Unable to simulate the monthly draw.",
      },
      {
        status: 500,
      },
    );
  }
}
