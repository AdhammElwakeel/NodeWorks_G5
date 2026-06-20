import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FreelancerProfile, Project, Proposal, User } from "@/lib/models";
import { syncProjectToKbs } from "@/lib/server/kbs-sync";

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || "http://localhost:8010";

async function parseApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

// GET /api/recommendations/projects/[id]/freelancers
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (payload.role !== "client") {
      return NextResponse.json({ error: "Only clients can use freelancer recommendations" }, { status: 403 });
    }

    const { id } = await params;
    const project = await Project.findById(id).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.clientId.toString() !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (project.kbsSync?.status !== "synced") {
      await syncProjectToKbs(id);
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 10);
    const proposals = await Proposal.find({ projectId: id }).select("freelancerId").lean();
    const excludeUserIds = proposals.map((proposal: any) => proposal.freelancerId.toString());

    const response = await fetch(`${AI_API_BASE_URL}/recommendations/freelancers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, limit, excludeUserIds }),
    });
    const result = await parseApiResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: result.detail || result.error || "Failed to generate recommendations" },
        { status: response.status }
      );
    }

    const recommendations = result.recommendations || [];
    const userIds = recommendations.map((item: any) => item.userId);
    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: userIds } }).lean(),
      FreelancerProfile.find({ userId: { $in: userIds } }).lean(),
    ]);
    const userById = new Map(users.map((user: any) => [user._id.toString(), user]));
    const profileByUserId = new Map(
      profiles.map((profile: any) => [profile.userId.toString(), profile])
    );

    const enriched = recommendations
      .map((item: any) => {
        const user = userById.get(item.userId);
        const profile = profileByUserId.get(item.userId);
        if (!user || !profile) return null;

        return {
          score: item.score,
          technicalScore: item.technicalScore,
          knowledgeScore: item.knowledgeScore,
          reason: item.reason,
          matchedSkills: item.matchedSkills || [],
          missingSkills: item.missingSkills || [],
          requiredSkills: item.requiredSkills || [],
          requiredDomains: item.requiredDomains || [],
          bestRole: item.bestRole,
          bestRoleScore: item.bestRoleScore,
          roleMatch: item.roleMatch,
          roleMatches: item.roleMatches || [],
          scoreBreakdown: item.scoreBreakdown,
          evidence: item.evidence,
          experienceDetails: item.experienceDetails || [],
          relevantExperienceDetails: item.relevantExperienceDetails || [],
          projectEvidenceDetails: item.projectEvidenceDetails || [],
          freelancer: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            headline: profile.headline,
            experienceLevel: profile.experienceLevel,
            country: profile.country,
            hourlyRate: profile.hourlyRate,
            availability: profile.availability,
            skills: profile.skills || [],
            kbsSync: profile.kbsSync,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ recommendations: enriched });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load freelancer recommendations" },
      { status: 500 }
    );
  }
}
