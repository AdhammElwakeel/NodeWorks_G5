import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models";
import { verifyToken } from "@/lib/auth";

// GET /api/projects/[id] — get single project
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

    const { id } = await params;
    const project = await Project.findById(id).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Count proposals
    const { Proposal } = await import("@/lib/models/Proposal");
    const proposalsCount = await Proposal.countDocuments({ projectId: id });

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        clientId: project.clientId.toString(),
        title: project.title,
        description: project.description,
        budget: project.budget,
        skills: project.skills || [],
        status: project.status,
        timeline: project.timeline,
        createdAt: (project as any).createdAt,
        updatedAt: (project as any).updatedAt,
        proposalsCount,
      },
    });
  } catch (error: any) {
    console.error("Project GET error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

// PATCH /api/projects/[id] — update project
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const project = await Project.findById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only the owner can update
    if (project.clientId.toString() !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    if (body.title !== undefined) project.title = body.title;
    if (body.description !== undefined) project.description = body.description;
    if (body.budget !== undefined) project.budget = body.budget;
    if (body.skills !== undefined) project.skills = body.skills;
    if (body.timeline !== undefined) project.timeline = body.timeline;
    if (body.status !== undefined) {
      if (!["open", "closed", "in-progress"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      project.status = body.status;
    }

    await project.save();

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        clientId: project.clientId.toString(),
        title: project.title,
        description: project.description,
        budget: project.budget,
        skills: project.skills || [],
        status: project.status,
        timeline: project.timeline,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Project PATCH error:", error?.message || error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}