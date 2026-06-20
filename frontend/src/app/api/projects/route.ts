import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models";
import { verifyToken } from "@/lib/auth";
import { syncProjectToKbs } from "@/lib/server/kbs-sync";

// GET /api/projects — list projects with filters
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const skill = searchParams.get("skill");

    const filter: Record<string, unknown> = {};

    if (mine === "true") {
      filter.clientId = payload.userId;
    }

    if (status && ["open", "closed", "in-progress"].includes(status)) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (skill) {
      filter.skills = { $in: [skill] };
    }

    const projects = await Project.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Count proposals for each project
    const { Proposal } = await import("@/lib/models/Proposal");
    const projectsWithCount = await Promise.all(
      projects.map(async (p) => {
        const count = await Proposal.countDocuments({ projectId: p._id });
        const obj = p as Record<string, any>;
        return {
          id: obj._id.toString(),
          clientId: obj.clientId.toString(),
          title: obj.title,
          description: obj.description,
          budget: obj.budget,
          skills: obj.skills || [],
          domainKeywords: obj.domainKeywords || [],
          requiredRoles: obj.requiredRoles || [],
          hiringMode: obj.hiringMode || "individual",
          status: obj.status,
          timeline: obj.timeline,
          kbsSync: obj.kbsSync,
          createdAt: obj.createdAt,
          updatedAt: obj.updatedAt,
          proposalsCount: count,
        };
      })
    );

    return NextResponse.json({ projects: projectsWithCount });
  } catch (error: any) {
    console.error("Projects GET error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST /api/projects — create a new project (client only)
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (payload.role !== "client") {
      return NextResponse.json({ error: "Only clients can create projects" }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, budget, skills, domainKeywords, requiredRoles, hiringMode, timeline } = body;

    if (!title || !description || !budget) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const project = await Project.create({
      clientId: payload.userId,
      title,
      description,
      budget,
      skills: skills || [],
      domainKeywords: Array.isArray(domainKeywords) ? domainKeywords : [],
      requiredRoles: Array.isArray(requiredRoles) ? requiredRoles : [],
      hiringMode: hiringMode === "team" ? "team" : "individual",
      timeline: timeline || undefined,
      status: "open",
      kbsSync: { status: "not_synced" },
    });

    let kbsSync = project.kbsSync;
    try {
      const sync = await syncProjectToKbs(project._id.toString());
      kbsSync = sync.kbsSync;
    } catch (syncError: any) {
      console.warn("Project auto KBS sync failed:", syncError?.message || syncError);
      const refreshedProject = await Project.findById(project._id).lean();
      kbsSync = refreshedProject?.kbsSync || kbsSync;
    }

    return NextResponse.json(
      {
        project: {
          id: project._id.toString(),
          clientId: project.clientId.toString(),
          title: project.title,
          description: project.description,
          budget: project.budget,
          skills: project.skills || [],
          domainKeywords: project.domainKeywords || [],
          requiredRoles: project.requiredRoles || [],
          hiringMode: project.hiringMode || "individual",
          status: project.status,
          timeline: project.timeline,
          kbsSync,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          proposalsCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Projects POST error:", error?.message || error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
