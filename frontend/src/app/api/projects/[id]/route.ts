import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models";
import { verifyToken } from "@/lib/auth";
import { syncProjectToKbs } from "@/lib/server/kbs-sync";
import { matchSkillsToLibrary } from "@/lib/server/skills";

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
        hiringMode: project.hiringMode || "individual",
        status: project.status,
        timeline: project.timeline,
        kbsSync: project.kbsSync,
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

    let recommendationDataChanged = false;

    if (body.title !== undefined) {
      project.title = body.title;
      recommendationDataChanged = true;
    }
    if (body.description !== undefined) {
      project.description = body.description;
      recommendationDataChanged = true;
    }
    if (body.budget !== undefined) {
      project.budget = body.budget;
      recommendationDataChanged = true;
    }
    if (body.skills !== undefined) {
      project.skills = await matchSkillsToLibrary(body.skills);
      recommendationDataChanged = true;
    }
    if (body.hiringMode !== undefined) {
      if (!["individual", "team"].includes(body.hiringMode)) {
        return NextResponse.json({ error: "Invalid hiring mode" }, { status: 400 });
      }
      project.hiringMode = body.hiringMode;
    }
    if (body.timeline !== undefined) {
      project.timeline = body.timeline;
      recommendationDataChanged = true;
    }
    if (body.status !== undefined) {
      if (!["open", "closed", "in-progress"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      project.status = body.status;
    }

    if (recommendationDataChanged && project.kbsSync?.status === "synced") {
      project.kbsSync.status = "outdated";
      project.kbsSync.error = undefined;
    }

    await project.save();

    if (recommendationDataChanged) {
      try {
        await syncProjectToKbs(project._id.toString());
      } catch (syncError: any) {
        console.warn("Project auto KBS sync failed:", syncError?.message || syncError);
      }
    }

    const updatedProject = await Project.findById(project._id).lean();

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        clientId: project.clientId.toString(),
        title: updatedProject?.title || project.title,
        description: updatedProject?.description || project.description,
        budget: updatedProject?.budget || project.budget,
        skills: updatedProject?.skills || project.skills || [],
        hiringMode: updatedProject?.hiringMode || project.hiringMode || "individual",
        status: updatedProject?.status || project.status,
        timeline: updatedProject?.timeline || project.timeline,
        kbsSync: updatedProject?.kbsSync || project.kbsSync,
        createdAt: updatedProject?.createdAt || project.createdAt,
        updatedAt: updatedProject?.updatedAt || project.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Project PATCH error:", error?.message || error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// DELETE /api/projects/[id] — delete a closed project owned by the current client
export async function DELETE(
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
      return NextResponse.json({ error: "Only clients can delete projects" }, { status: 403 });
    }

    const { id } = await params;
    const project = await Project.findById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.clientId.toString() !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (project.status !== "closed") {
      return NextResponse.json(
        { error: "Only closed projects can be deleted" },
        { status: 400 }
      );
    }

    const { Proposal } = await import("@/lib/models/Proposal");
    await Proposal.deleteMany({ projectId: project._id });
    await project.deleteOne();

    return NextResponse.json({ status: "deleted", projectId: id });
  } catch (error: unknown) {
    console.error("Project DELETE error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
