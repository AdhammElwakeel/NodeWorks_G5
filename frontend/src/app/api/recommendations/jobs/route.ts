import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FreelancerProfile, Project, Proposal } from "@/lib/models";
import { syncFreelancerToKbs } from "@/lib/server/kbs-sync";

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || "http://localhost:8010";

interface LeanProject {
  _id: { toString(): string };
  clientId: { toString(): string };
  title: string;
  description: string;
  budget: number;
  skills: string[];
  status: string;
  timeline?: string;
  kbsSync?: { status: string; syncedAt?: string; error?: string };
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface JobRecommendationItem {
  projectId: string;
  score: number;
  reason: string;
  matchedSkills?: string[];
  missingSkills?: string[];
  requiredSkills?: string[];
  bestRole?: string;
  bestRoleScore?: number;
  scoreBreakdown?: Record<string, number | undefined>;
  evidence?: Record<string, string[] | undefined>;
  experienceDetails?: unknown[];
  relevantExperienceDetails?: unknown[];
  projectEvidenceDetails?: unknown[];
}

interface AiApiResponse {
  recommendations?: JobRecommendationItem[];
  detail?: string;
  error?: string;
}

async function parseApiResponse(response: Response): Promise<AiApiResponse> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as AiApiResponse;
  } catch {
    return { detail: text };
  }
}

function serializeProject(project: LeanProject, proposalsCount: number) {
  return {
    id: project._id.toString(),
    clientId: project.clientId.toString(),
    title: project.title,
    description: project.description,
    budget: project.budget,
    skills: project.skills || [],
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
    const excludeProjectIds = applied.map((proposal) => proposal.projectId.toString());

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
    const projectIds = recommendations.map((item) => item.projectId);
    const projects = (await Project.find({ _id: { $in: projectIds }, status: "open" }).lean()) as unknown as LeanProject[];
    const projectById = new Map(projects.map((project) => [project._id.toString(), project]));

    const enriched = await Promise.all(
      recommendations.map(async (item) => {
        const project = projectById.get(item.projectId);
        if (!project) return null;
        const proposalsCount = await Proposal.countDocuments({ projectId: project._id });
        return {
          score: item.score,
          reason: item.reason,
          matchedSkills: item.matchedSkills || [],
          missingSkills: item.missingSkills || [],
          requiredSkills: item.requiredSkills || [],
          bestRole: item.bestRole,
          bestRoleScore: item.bestRoleScore,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job recommendations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
