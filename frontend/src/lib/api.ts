import type { User } from "./auth-context";

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchApi<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
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

  return data as T;
}

// ─── Auth ──────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    name: string;
    role: "freelancer" | "client";
  }): Promise<{ user: User }> =>
    fetchApi("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }): Promise<{ user: User }> =>
    fetchApi("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: (): Promise<{ user: User }> => fetchApi("/auth/me"),
  logout: () => fetchApi("/auth/logout", { method: "POST" }),
};

// ─── Profile ───────────────────────────────────────────────────────────

export const profileApi = {
  get: (): Promise<{ user: User }> => fetchApi("/users/profile"),
  update: (body: {
    name?: string;
    avatar?: string;
    profile?: Record<string, unknown>;
  }) =>
    fetchApi("/users/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// ─── Freelancers ───────────────────────────────────────────────────────

export interface PublicFreelancerData {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  headline?: string;
  experienceLevel?: string;
  country?: string;
  skills: string[];
  about?: string;
  hourlyRate?: number;
  availability?: string;
  portfolioLinks?: string[];
  cvAnalysis?: {
    yearsOfExperience?: string;
    experience?: { role?: string; company?: string; years?: string }[];
    projects?: { name?: string; technologies?: string[] }[];
    bestRole?: string;
    bestScore?: number;
  };
}

export const freelancerApi = {
  get: (id: string): Promise<{ freelancer: PublicFreelancerData }> =>
    fetchApi(`/freelancers/${id}`),
};

// ─── Projects ──────────────────────────────────────────────────────────

export interface ProjectData {
  id: string;
  clientId: string;
  title: string;
  description: string;
  budget: number;
  skills: string[];
  hiringMode?: "individual" | "team";
  status: "open" | "closed" | "in-progress";
  timeline?: string;
  kbsSync?: {
    status: "not_synced" | "synced" | "outdated" | "failed";
    syncedAt?: string;
    error?: string;
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
      ([, v]) => v !== undefined,
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
    hiringMode?: "individual" | "team";
    timeline?: string;
  }): Promise<{ project: ProjectData }> =>
    fetchApi("/projects", { method: "POST", body: JSON.stringify(body) }),

  suggestSkills: (body: {
    title: string;
    description: string;
    skills: string[];
  }): Promise<{ skills: string[] }> =>
    fetchApi("/projects/suggest-skills", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: Partial<ProjectData>,
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
      ([, v]) => v !== undefined,
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
  list: (): Promise<{
    skills: { id: string; name: string; category: string }[];
  }> => fetchApi("/skills"),
};

// ─── Messages ──────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  participants: { id: string; name: string; avatar?: string | null }[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt?: string | null;
  createdAt: string;
}

export const messageApi = {
  conversations: (): Promise<{
    conversations: ConversationSummary[];
    totalUnread?: number;
  }> => fetchApi("/messages"),
  getThread: (withUserId: string): Promise<{ messages: MessageData[] }> =>
    fetchApi(`/messages?with=${withUserId}`),
  send: (body: { receiverId: string; content: string }): Promise<{
    message: MessageData;
  }> =>
    fetchApi("/messages", { method: "POST", body: JSON.stringify(body) }),
};

// ─── Recommendations (stub — AI team feature) ──────────────────────────

export type KbsScoreBreakdown = Record<string, number | undefined>;
export type KbsEvidence = Record<string, string[] | undefined>;
export type KbsExperienceDetail = {
  company?: string;
  role?: string;
  duration?: string;
};
export type KbsProjectEvidenceDetail = {
  project?: string;
  technology?: string;
};

export const recApi = {
  jobs: (params?: {
    limit?: number;
  }): Promise<{
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
      experienceDetails?: KbsExperienceDetail[];
      relevantExperienceDetails?: KbsExperienceDetail[];
      projectEvidenceDetails?: KbsProjectEvidenceDetail[];
      project: ProjectData;
    }[];
  }> => {
    const qs = params?.limit ? `?limit=${params.limit}` : "";
    return fetchApi(`/recommendations/jobs${qs}`);
  },
  freelancers: (
    projectId: string,
    params?: { limit?: number },
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
      experienceDetails?: KbsExperienceDetail[];
      relevantExperienceDetails?: KbsExperienceDetail[];
      projectEvidenceDetails?: KbsProjectEvidenceDetail[];
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
    params?: { limit?: number; maxTeamSize?: number },
  ): Promise<{
    requiredSkills: string[];
    requiredRoles: { name: string; count: number }[];
    recommendations: {
      score: number;
      finalScore: number;
      technicalScore: number;
      synergyScore: number;
      coverageScore: number;
      reason: string;
      coveredSkills: string[];
      missingSkills: string[];
      sharedEntities: string[];
      members: {
        userId: string;
        name: string;
        headline?: string;
        experienceLevel?: string;
        hourlyRate?: number;
        skills: string[];
        coveredSkills: string[];
        bestRole?: string;
        bestRoleScore?: number;
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
  syncFreelancer: (): Promise<{
    kbsSync: ProjectData["kbsSync"];
    result: unknown;
  }> => fetchApi("/kbs/freelancer/sync", { method: "POST" }),
  syncProject: (
    projectId: string,
  ): Promise<{ kbsSync: ProjectData["kbsSync"]; result: unknown }> =>
    fetchApi(`/kbs/projects/${projectId}/sync`, { method: "POST" }),
  list: (params?: { category?: string; search?: string; mine?: boolean }) => {
    const entries = Object.entries(params || {}).filter(
      ([, v]) => v !== undefined,
    );
    const qs = entries.length
      ? "?" + new URLSearchParams(entries as [string, string][]).toString()
      : "";
    return fetchApi(`/kbs${qs}`);
  },
  getBySlug: (slug: string) => fetchApi(`/kbs?slug=${slug}`),
  create: (body: Record<string, unknown>) =>
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
  start: (body?: {
    candidateId?: string;
    numSkills?: number;
    cvData?: Record<string, unknown>;
  }) =>
    fetchApi("/interview/start", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  submitAnswer: (body: {
    sessionId: string;
    answer: string;
    demoResult?: "right" | "wrong";
  }) =>
    fetchApi("/interview/submit-answer", {
      method: "POST",
      body: JSON.stringify({
        session_id: body.sessionId,
        answer: body.answer,
        demo_result: body.demoResult ?? null,
      }),
    }),
  reportViolation: (body: {
    sessionId: string;
    violationType: "tab_switch" | "paste_attempt" | string;
  }) =>
    fetchApi("/interview/report-violation", {
      method: "POST",
      body: JSON.stringify({
        session_id: body.sessionId,
        violation_type: body.violationType,
      }),
    }),
  getStatus: (sessionId: string) => fetchApi(`/interview/${sessionId}/status`),
  getReport: (sessionId: string) => fetchApi(`/interview/${sessionId}/report`),
  saveResult: (body: {
    sessionId: string;
    overallScore: number;
    rawScore?: number;
    isVerified: boolean;
    totalQuestions: number;
    cheatingDetected: boolean;
    skillScores: Array<{
      skill: string;
      score: number;
      questionsAsked: number;
    }>;
    englishScore?: number;
    penalty?: number;
    penaltyBreakdown?: { violations: number; cheatFlags: number; total: number };
    strongSkills?: string[];
    badgeTier?: "gold" | "silver" | "bronze" | null;
    violations?: number;
  }) =>
    fetchApi("/interviews", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
