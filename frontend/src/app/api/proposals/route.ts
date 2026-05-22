import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Proposal, Project } from "@/lib/models";
import { verifyToken } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

interface ProposalRequestBody {
  projectId: string;
  coverLetter: string;
  proposedRate: number;
  estimatedDuration?: string;
  portfolioFileName?: string;
  portfolioFileUrl?: string;
  portfolioFile?: File;
}

interface PopulatedRef {
  _id?: { toString(): string };
  title?: string;
  name?: string;
  avatar?: string | null;
  toString(): string;
}

interface ProposalListItem {
  _id: { toString(): string };
  projectId: PopulatedRef;
  freelancerId: PopulatedRef;
  coverLetter: string;
  proposedRate: number;
  estimatedDuration?: string;
  portfolioFileName?: string;
  portfolioFileUrl?: string;
  status: string;
  createdAt: Date;
}

interface PopulatedProject {
  _id: { toString(): string };
  clientId?: { toString(): string };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function savePortfolioFile(file: File, userId: string) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Portfolio attachment must be a PDF file");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "portfolio");
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${userId}-${Date.now()}-${safeFileName(file.name)}`;
  await writeFile(path.join(uploadDir, fileName), bytes);

  return {
    portfolioFileName: file.name,
    portfolioFileUrl: `/uploads/portfolio/${fileName}`,
  };
}

async function readProposalBody(
  req: NextRequest
): Promise<ProposalRequestBody> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("portfolioFile");
    return {
      projectId: String(form.get("projectId") || ""),
      coverLetter: String(form.get("coverLetter") || ""),
      proposedRate: Number(form.get("proposedRate") || 0),
      estimatedDuration: String(form.get("estimatedDuration") || "") || undefined,
      portfolioFile: file instanceof File ? file : undefined,
    };
  }

  return req.json() as Promise<ProposalRequestBody>;
}

// GET /api/proposals — list proposals
// ?projectId=... → proposals for a specific project
// ?mine=true    → proposals sent by current user
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const mine = searchParams.get("mine");

    const filter: Record<string, unknown> = {};

    if (mine === "true") {
      filter.freelancerId = payload.userId;
    }

    if (projectId) {
      const project = await Project.findById(projectId).lean();
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      filter.projectId = projectId;

      if (payload.role === "client") {
        if (project.clientId.toString() !== payload.userId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        filter.freelancerId = payload.userId;
      }
    } else if (payload.role === "client" && mine !== "true") {
      const projectIds = await Project.find({ clientId: payload.userId }).distinct("_id");
      filter.projectId = { $in: projectIds };
    }

    const proposals = await Proposal.find(filter)
      .populate("freelancerId", "name email avatar")
      .populate("projectId", "title")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      proposals: proposals.map((proposal) => {
        const p = proposal as ProposalListItem;
        return {
          id: p._id.toString(),
          projectId: p.projectId?._id?.toString() || p.projectId.toString(),
          projectTitle: p.projectId?.title || "Unknown Project",
          freelancerId: p.freelancerId?._id?.toString() || p.freelancerId.toString(),
          freelancerName: p.freelancerId?.name || "Unknown",
          freelancerAvatar: p.freelancerId?.avatar || null,
          coverLetter: p.coverLetter,
          proposedRate: p.proposedRate,
          estimatedDuration: p.estimatedDuration,
          portfolioFileName: p.portfolioFileName,
          portfolioFileUrl: p.portfolioFileUrl,
          status: p.status,
          submittedAt: p.createdAt,
        };
      }),
    });
  } catch (error: unknown) {
    console.error("Proposals GET error:", errorMessage(error));
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }
}

// POST /api/proposals — submit a proposal (freelancer only)
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (payload.role !== "freelancer") {
      return NextResponse.json({ error: "Only freelancers can submit proposals" }, { status: 403 });
    }

    const body = await readProposalBody(req);
    const {
      projectId,
      coverLetter,
      proposedRate,
      estimatedDuration,
      portfolioFile,
    } = body;

    if (!projectId || !coverLetter || !proposedRate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check project exists and is open
    let project;
    try {
      project = await Project.findById(projectId);
    } catch {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.status !== "open") {
      return NextResponse.json({ error: "Project is not open for proposals" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await Proposal.findOne({
      projectId,
      freelancerId: payload.userId,
    });
    if (existing) {
      return NextResponse.json({ error: "You already submitted a proposal for this project" }, { status: 409 });
    }

    const portfolioData = portfolioFile
      ? await savePortfolioFile(portfolioFile, payload.userId)
      : {};

    const proposal = await Proposal.create({
      projectId,
      freelancerId: payload.userId,
      coverLetter,
      proposedRate,
      estimatedDuration: estimatedDuration || undefined,
      ...portfolioData,
      status: "pending",
    });

    return NextResponse.json(
      {
        proposal: {
          id: proposal._id.toString(),
          projectId: proposal.projectId.toString(),
          freelancerId: proposal.freelancerId.toString(),
          coverLetter: proposal.coverLetter,
          proposedRate: proposal.proposedRate,
          portfolioFileName: proposal.portfolioFileName,
          portfolioFileUrl: proposal.portfolioFileUrl,
          status: proposal.status,
          submittedAt: proposal.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // Duplicate key error
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "You already submitted a proposal for this project" },
        { status: 409 }
      );
    }
    console.error("Proposals POST error:", errorMessage(error));
    return NextResponse.json({ error: "Failed to submit proposal" }, { status: 500 });
  }
}

// PATCH /api/proposals — accept or reject a proposal (client only)
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { proposalId, status } = body;

    if (!proposalId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["accepted", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const proposal = await Proposal.findById(proposalId).populate("projectId");
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Only the project owner can accept/reject
    const project = proposal.projectId as PopulatedProject;
    if (project.clientId?.toString() !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    proposal.status = status;
    await proposal.save();

    // If accepted, close other pending proposals and mark project in-progress
    if (status === "accepted") {
      await Proposal.updateMany(
        { projectId: project._id, _id: { $ne: proposalId }, status: "pending" },
        { status: "rejected" }
      );
      await Project.findByIdAndUpdate(project._id, { status: "in-progress" });
    }

    return NextResponse.json({
      proposal: {
        id: proposal._id.toString(),
        projectId: proposal.projectId.toString(),
        freelancerId: proposal.freelancerId.toString(),
        status: proposal.status,
      },
    });
  } catch (error: unknown) {
    console.error("Proposals PATCH error:", errorMessage(error));
    return NextResponse.json({ error: "Failed to update proposal" }, { status: 500 });
  }
}
