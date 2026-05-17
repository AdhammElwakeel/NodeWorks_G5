import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Proposal, Project } from "@/lib/models";
import { verifyToken } from "@/lib/auth";

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
      proposals: proposals.map((p: any) => ({
        id: p._id.toString(),
        projectId: p.projectId?._id?.toString() || p.projectId.toString(),
        projectTitle: p.projectId?.title || "Unknown Project",
        freelancerId: p.freelancerId?._id?.toString() || p.freelancerId.toString(),
        freelancerName: p.freelancerId?.name || "Unknown",
        freelancerAvatar: p.freelancerId?.avatar || null,
        coverLetter: p.coverLetter,
        proposedRate: p.proposedRate,
        estimatedDuration: p.estimatedDuration,
        status: p.status,
        submittedAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Proposals GET error:", error?.message || error);
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

    const body = await req.json();
    const { projectId, coverLetter, proposedRate, estimatedDuration } = body;

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

    const proposal = await Proposal.create({
      projectId,
      freelancerId: payload.userId,
      coverLetter,
      proposedRate,
      estimatedDuration: estimatedDuration || undefined,
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
          status: proposal.status,
          submittedAt: proposal.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    // Duplicate key error
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "You already submitted a proposal for this project" },
        { status: 409 }
      );
    }
    console.error("Proposals POST error:", error?.message || error);
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
    const project = proposal.projectId as any;
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
  } catch (error: any) {
    console.error("Proposals PATCH error:", error?.message || error);
    return NextResponse.json({ error: "Failed to update proposal" }, { status: 500 });
  }
}
