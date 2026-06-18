import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FreelancerProfile } from "@/lib/models";
import { verifyToken } from "@/lib/auth";

async function getCurrentUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return payload;
}

// POST /api/interviews - Save interview results (latest + push previous to history)
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      sessionId,
      overallScore,
      rawScore,
      isVerified,
      totalQuestions,
      cheatingDetected,
      skillScores,
      englishScore,
      penalty,
      penaltyBreakdown,
      strongSkills,
      badgeTier,
      violations,
    } = body;

    if (!sessionId || overallScore === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, overallScore" },
        { status: 400 },
      );
    }

    const newResult = {
      sessionId,
      overallScore,
      rawScore,
      isVerified: isVerified ?? false,
      totalQuestions,
      cheatingDetected: cheatingDetected ?? false,
      skillScores: skillScores ?? [],
      completedAt: new Date(),
      englishScore,
      penalty,
      penaltyBreakdown,
      strongSkills: strongSkills ?? [],
      badgeTier: badgeTier ?? null,
      violations: violations ?? 0,
    };

    // Push the existing interviewResult (if any) into history, then set the new one.
    const existing = await FreelancerProfile.findOne({ userId: user.userId }).select("interviewResult");

    const updateOps: Record<string, unknown> = {
      $set: {
        interviewResult: newResult,
        isVerified: isVerified ?? false,
      },
    };

    if (existing?.interviewResult) {
      updateOps.$push = { interviewHistory: existing.interviewResult };
    }

    const result = await FreelancerProfile.findOneAndUpdate(
      { userId: user.userId },
      updateOps,
      { upsert: true, new: true },
    );

    return NextResponse.json({
      success: true,
      profile: result,
    });
  } catch (error: unknown) {
    console.error("Interview save error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

// GET /api/interviews - Retrieve interview results for current user
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await FreelancerProfile.findOne({ userId: user.userId });

    if (!profile) {
      return NextResponse.json({ interviewResult: null, interviewHistory: [] });
    }

    return NextResponse.json({
      interviewResult: profile.interviewResult || null,
      interviewHistory: profile.interviewHistory || [],
      isVerified: profile.isVerified || false,
    });
  } catch (error: unknown) {
    console.error("Interview fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
