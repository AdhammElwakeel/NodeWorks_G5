import { FreelancerProfile, Project, User } from "@/lib/models";

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

function shouldSync(status?: string) {
  return status !== "synced";
}

export async function syncFreelancerToKbs(userId: string) {
  const user = await User.findById(userId);
  const profile = await FreelancerProfile.findOne({ userId });

  if (!user || !profile) {
    throw new Error("Freelancer profile not found");
  }

  if (!shouldSync(profile.kbsSync?.status)) {
    return { skipped: true, kbsSync: profile.kbsSync };
  }

  const profileObject = profile.toObject();
  const syncPayload = {
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    profile: {
      headline: profileObject.headline,
      experienceLevel: profileObject.experienceLevel,
      country: profileObject.country,
      skills: profileObject.skills || [],
      about: profileObject.about,
      hourlyRate: profileObject.hourlyRate,
      availability: profileObject.availability,
      portfolioLinks: profileObject.portfolioLinks || [],
      cvFileName: profileObject.cvFileName,
      cvAnalysis: profileObject.cvAnalysis,
    },
  };

  const response = await fetch(`${AI_API_BASE_URL}/kbs/freelancers/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(syncPayload),
  });
  const result = await parseApiResponse(response);

  if (!response.ok) {
    profile.kbsSync = {
      status: "failed",
      syncedAt: profile.kbsSync?.syncedAt,
      error: result.detail || result.error || "KBS sync failed",
    };
    await profile.save();
    throw new Error(profile.kbsSync.error || "KBS sync failed");
  }

  profile.kbsSync = {
    status: "synced",
    syncedAt: new Date(),
    error: undefined,
  };
  await profile.save();

  return { skipped: false, result, kbsSync: profile.kbsSync };
}

export async function syncProjectToKbs(projectId: string) {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (!shouldSync(project.kbsSync?.status)) {
    return { skipped: true, kbsSync: project.kbsSync };
  }

  const syncPayload = {
    projectId: project._id.toString(),
    clientId: project.clientId.toString(),
    title: project.title,
    description: project.description,
    budget: project.budget,
    skills: project.skills || [],
    status: project.status,
    timeline: project.timeline,
    createdAt: project.createdAt?.toISOString(),
    updatedAt: project.updatedAt?.toISOString(),
  };

  const response = await fetch(`${AI_API_BASE_URL}/kbs/projects/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(syncPayload),
  });
  const result = await parseApiResponse(response);

  if (!response.ok) {
    project.kbsSync = {
      status: "failed",
      syncedAt: project.kbsSync?.syncedAt,
      error: result.detail || result.error || "KBS sync failed",
    };
    await project.save();
    throw new Error(project.kbsSync.error || "KBS sync failed");
  }

  project.kbsSync = {
    status: "synced",
    syncedAt: new Date(),
    error: undefined,
  };
  await project.save();

  return { skipped: false, result, kbsSync: project.kbsSync };
}
