const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  }

  return data;
}

// ─── Auth ──────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    name: string;
    role: "freelancer" | "client";
  }) =>
    fetchApi("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    fetchApi("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => fetchApi("/auth/me"),
  logout: () => fetchApi("/auth/logout", { method: "POST" }),
};

// ─── Profile ───────────────────────────────────────────────────────────

export const profileApi = {
  get: () => fetchApi("/users/profile"),
  update: (body: {
    name?: string;
    avatar?: string;
    profile?: Record<string, any>;
  }) =>
    fetchApi("/users/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// ─── Projects ──────────────────────────────────────────────────────────

export interface ProjectData {
  id: string;
  clientId: string;
  title: string;
  description: string;
  budget: number;
  skills: string[];
  status: "open" | "closed" | "in-progress";
  timeline?: string;
  kbsSync?: {
    status: "not_synced" | "synced" | "outdated" | "failed";
    syncedAt?: string;
    error?: string;
    graphVersion?: number;
  };
  createdAt: string;
  updatedAt: string;
  proposalsCount: number;
}

export const projectApi = {
  list: (params?: {
    mine?: boolean;
    status?: string;
    search?: string;
    skill?: string;
  }): Promise<{ projects: ProjectData[] }> => {
    const entries = Object.entries(params || {}).filter(
      ([, v]) => v !== undefined
    );
    const qs = entries.length
      ? "?" + new URLSearchParams(entries as [string, string][]).toString()
      : "";
    return fetchApi(`/projects${qs}`);
  },

  get: (id: string): Promise<{ project: ProjectData }> =>
    fetchApi(`/projects/${id}`),

  create: (body: {
    title: string;
    description: string;
    budget: number;
    skills: string[];
    timeline?: string;
  }): Promise<{ project: ProjectData }> =>
    fetchApi("/projects", { method: "POST", body: JSON.stringify(body) }),

  update: (
    id: string,
    body: Partial<ProjectData>
  ): Promise<{ project: ProjectData }> =>
    fetchApi(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// ─── Proposals ─────────────────────────────────────────────────────────

export interface ProposalData {
  id: string;
  projectId: string;
  projectTitle?: string;
  freelancerId?: string;
  freelancerName?: string;
  freelancerAvatar?: string | null;
  coverLetter: string;
  proposedRate: number;
  estimatedDuration?: string;
  portfolioFileName?: string;
  portfolioFileUrl?: string;
  status: "pending" | "accepted" | "rejected";
  submittedAt: string;
}

export const proposalApi = {
  list: (params?: {
    projectId?: string;
    mine?: boolean;
  }): Promise<{ proposals: ProposalData[] }> => {
    const entries = Object.entries(params || {}).filter(
      ([, v]) => v !== undefined
    );
    const qs = entries.length
      ? "?" + new URLSearchParams(entries as [string, string][]).toString()
      : "";
    return fetchApi(`/proposals${qs}`);
  },

  create: (body: {
    projectId: string;
    coverLetter: string;
    proposedRate: number;
    estimatedDuration?: string;
    portfolioFile?: File | null;
  }): Promise<{ proposal: ProposalData }> => {
    if (body.portfolioFile) {
      const formData = new FormData();
      formData.append("projectId", body.projectId);
      formData.append("coverLetter", body.coverLetter);
      formData.append("proposedRate", String(body.proposedRate));
      if (body.estimatedDuration) {
        formData.append("estimatedDuration", body.estimatedDuration);
      }
      formData.append("portfolioFile", body.portfolioFile);

      return fetch(`${API_BASE}/proposals`, {
        method: "POST",
        body: formData,
        credentials: "include",
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
        }
        return data;
      });
    }

    return fetchApi("/proposals", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update: (body: {
    proposalId: string;
    status: "accepted" | "rejected";
  }): Promise<{ proposal: ProposalData }> =>
    fetchApi("/proposals", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// ─── Skills ────────────────────────────────────────────────────────────

export const skillApi = {
  list: (): Promise<{ skills: { id: string; name: string; category: string }[] }> =>
    fetchApi("/skills"),
};

// ─── Messages ──────────────────────────────────────────────────────────

export const messageApi = {
  conversations: () => fetchApi("/messages"),
  getThread: (withUserId: string) => fetchApi(`/messages?with=${withUserId}`),
  send: (body: { receiverId: string; content: string }) =>
    fetchApi("/messages", { method: "POST", body: JSON.stringify(body) }),
};

// ─── Recommendations (stub — AI team feature) ──────────────────────────

export type KbsScoreBreakdown = Record<string, number | undefined>;
export type KbsEvidence = Record<string, string[] | undefined>;
export type LlmRecommendationEvaluation = {
  fitScore: number;
  confidence: "low" | "medium" | "high";
  recommendation: "strong_fit" | "good_fit" | "possible_fit" | "not_recommended";
  reason: string;
  evidenceUsed: string[];
  risks: string[];
  clientQuestions: string[];
};

export const recApi = {
  jobs: (params?: { limit?: number }): Promise<{
    recommendations: {
      score: number;
      reason: string;
      matchedSkills: string[];
      missingSkills: string[];
      requiredSkills: string[];
      bestRole?: string;
      bestRoleScore?: number;
      scoreBreakdown?: KbsScoreBreakdown;
      evidence?: KbsEvidence;
      evidenceFacts?: string[];
      llmEvaluation?: LlmRecommendationEvaluation;
      project: ProjectData;
    }[];
  }> => {
    const qs = params?.limit ? `?limit=${params.limit}` : "";
    return fetchApi(`/recommendations/jobs${qs}`);
  },
  freelancers: (
    projectId: string,
    params?: { limit?: number }
  ): Promise<{
    recommendations: {
      score: number;
      reason: string;
      matchedSkills: string[];
      missingSkills: string[];
      requiredSkills: string[];
      bestRole?: string;
      bestRoleScore?: number;
      scoreBreakdown?: KbsScoreBreakdown;
      evidence?: KbsEvidence;
      evidenceFacts?: string[];
      llmEvaluation?: LlmRecommendationEvaluation;
      freelancer: {
        id: string;
        name: string;
        email: string;
        avatar?: string | null;
        headline?: string;
        experienceLevel?: string;
        country?: string;
        hourlyRate?: number;
        availability?: string;
        skills: string[];
        kbsSync?: ProjectData["kbsSync"];
      };
    }[];
  }> => {
    const qs = params?.limit ? `?limit=${params.limit}` : "";
    return fetchApi(`/recommendations/projects/${projectId}/freelancers${qs}`);
  },
  team: (
    projectId: string,
    params?: { limit?: number; maxTeamSize?: number }
  ): Promise<{
    requiredSkills: string[];
    requiredRoles: { name: string; count: number }[];
    recommendations: {
      score: number;
      finalScore: number;
      technicalScore: number;
      synergyScore: number;
      coverageScore: number;
      roleScore?: number;
      projectEvidenceScore?: number;
      experienceScore?: number;
      availabilityScore?: number;
      budgetFitScore?: number;
      complementarityScore?: number;
      sharedContextScore?: number;
      scoreBreakdown?: KbsScoreBreakdown;
      reason: string;
      coveredSkills: string[];
      missingSkills: string[];
      evidenceSkills?: string[];
      sharedEntities: string[];
      members: {
        userId: string;
        name: string;
        headline?: string;
        experienceLevel?: string;
        hourlyRate?: number;
        skills: string[];
        coveredSkills: string[];
        evidenceSkills?: string[];
        bestRole?: string;
        bestRoleScore?: number;
        roleFitScore?: number;
      }[];
    }[];
  }> => {
    const entries = Object.entries(params || {})
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) => [key, String(value)] as [string, string]);
    const qs = entries.length
      ? "?" + new URLSearchParams(entries).toString()
      : "";
    return fetchApi(`/recommendations/projects/${projectId}/team${qs}`);
  },
  get: (body: { context?: string; projectId?: string; limit?: number }) =>
    fetchApi("/recommendations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ─── KBS (stub — AI team feature) ──────────────────────────────────────

export const kbsApi = {
  health: () => fetchApi("/kbs/health"),
  syncFreelancer: (): Promise<{ kbsSync: ProjectData["kbsSync"]; result: any }> =>
    fetchApi("/kbs/freelancer/sync", { method: "POST" }),
  syncProject: (
    projectId: string
  ): Promise<{ kbsSync: ProjectData["kbsSync"]; result: any }> =>
    fetchApi(`/kbs/projects/${projectId}/sync`, { method: "POST" }),
  list: (params?: { category?: string; search?: string; mine?: boolean }) => {
    const entries = Object.entries(params || {}).filter(
      ([, v]) => v !== undefined
    );
    const qs = entries.length
      ? "?" + new URLSearchParams(entries as [string, string][]).toString()
      : "";
    return fetchApi(`/kbs${qs}`);
  },
  getBySlug: (slug: string) => fetchApi(`/kbs?slug=${slug}`),
  create: (body: any) =>
    fetchApi("/kbs", { method: "POST", body: JSON.stringify(body) }),
};

// ─── CV ────────────────────────────────────────────────────────────────

export const cvApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(`${API_BASE}/cv/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok)
        throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
      return data;
    });
  },
};

// ─── Interviews ────────────────────────────────────────────────────────

export const interviewApi = {
  list: () => fetchApi("/interviews"),
  create: () => fetchApi("/interviews", { method: "POST" }),
  submit: (body: {
    interviewId: string;
    responses: any[];
    scores?: any;
  }) =>
    fetchApi("/interviews", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
