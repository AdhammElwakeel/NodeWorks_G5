import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FreelancerProfile, Project, Proposal } from "@/lib/models";
import { syncFreelancerToKbs } from "@/lib/server/kbs-sync";

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

function serializeProject(project: any, proposalsCount: number) {
  return {
    id: project._id.toString(),
    clientId: project.clientId.toString(),
    title: project.title,
    description: project.description,
    budget: project.budget,
    skills: project.skills || [],
    domainKeywords: project.domainKeywords || [],
    requiredRoles: project.requiredRoles || [],
    status: project.status,
    timeline: project.timeline,
    kbsSync: project.kbsSync,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    proposalsCount,
  };
}

// GET /api/recommendations/jobs — KBS-backed job recommendations for current freelancer
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (payload.role !== "freelancer") {
      return NextResponse.json({ error: "Only freelancers can use job recommendations" }, { status: 403 });
    }

    const profile = await FreelancerProfile.findOne({ userId: payload.userId }).lean();
    if (!profile) {
      return NextResponse.json({ error: "Freelancer profile not found" }, { status: 404 });
    }

    if (profile.kbsSync?.status !== "synced") {
      await syncFreelancerToKbs(payload.userId);
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 10);
    const applied = await Proposal.find({ freelancerId: payload.userId }).select("projectId").lean();
    const excludeProjectIds = applied.map((proposal: any) => proposal.projectId.toString());

    const response = await fetch(`${AI_API_BASE_URL}/recommendations/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: payload.userId, limit, excludeProjectIds }),
    });
    const result = await parseApiResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: result.detail || result.error || "Failed to generate recommendations" },
        { status: response.status }
      );
    }

    const recommendations = result.recommendations || [];
    const projectIds = recommendations.map((item: any) => item.projectId);
    const projects = await Project.find({ _id: { $in: projectIds }, status: "open" }).lean();
    const projectById = new Map(projects.map((project: any) => [project._id.toString(), project]));

    const enriched = await Promise.all(
      recommendations.map(async (item: any) => {
        const project = projectById.get(item.projectId);
        if (!project) return null;
        const proposalsCount = await Proposal.countDocuments({ projectId: project._id });
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
          project: serializeProject(project, proposalsCount),
        };
      })
    );

    return NextResponse.json({ recommendations: enriched.filter(Boolean) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load job recommendations" },
      { status: 500 }
    );
  }
}
