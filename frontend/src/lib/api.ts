const API_BASE = "/api";

// The shared API wrapper is intentionally dynamic because individual endpoint
// helpers narrow the response shape where the app needs strong typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

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
): Promise<ApiResponse> {
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
    domainKnowledge?: string[];
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
  domainKeywords?: string[];
  requiredRoles?: string[];
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
    domainKeywords?: string[];
    requiredRoles?: string[];
    hiringMode?: "individual" | "team";
    timeline?: string;
  }): Promise<{ project: ProjectData }> =>
    fetchApi("/projects", { method: "POST", body: JSON.stringify(body) }),

  suggestSkills: (body: {
    title: string;
    description: string;
    skills: string[];
  }): Promise<{ skills: string[]; domainKeywords: string[]; requiredRoles: string[]; projectKeywords: string[] }> =>
    fetchApi("/projects/suggest-skills", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (
    id: string,
    body: Partial<ProjectData>
  ): Promise<{ project: ProjectData }> =>
    fetchApi(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (id: string): Promise<{ status: string; projectId: string }> =>
    fetchApi(`/projects/${id}`, { method: "DELETE" }),
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

// ─── AI Interview ───────────────────────────────────────────────────────

export interface InterviewQuestionData {
  question_text: string;
  focus_concept: string;
  skill_name: string;
  is_followup: boolean;
  followup_number: number;
  question_number: number;
  total_questions: number;
}

export interface InterviewSkillScore {
  skill: string;
  score: number;
  questions_asked: number;
}

export interface InterviewReportData {
  session_id: string;
  candidate_id?: string;
  overall_score: number;
  raw_score?: number;
  is_verified: boolean;
  skill_scores: InterviewSkillScore[];
  total_questions: number;
  cheating_detected?: boolean;
  violations?: number;
  violation_types?: string[];
  violation_reasons?: { type: string; reason: string; occurred_at: string }[];
  english_score?: number;
  penalty?: number;
  strong_skills?: string[];
  badge_tier?: "gold" | "silver" | "bronze" | null;
  completed_at?: string;
}

export const interviewApi = {
  start: (body: {
    candidate_id?: string;
    num_skills?: number;
    cv_data: Record<string, unknown>;
  }): Promise<{
    session_id: string;
    candidate_name?: string;
    skills_to_test: string[];
    total_questions: number;
    questions_per_skill: number;
    first_question: InterviewQuestionData | null;
  }> =>
    fetchApi("/interview/start", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submitAnswer: (body: {
    session_id: string;
    answer: string;
    demo_result?: "right" | "wrong";
  }): Promise<{
    status: "in_progress" | "completed";
    next_question: InterviewQuestionData | null;
    questions_answered: number;
    total_questions: number;
    report: InterviewReportData | null;
  }> =>
    fetchApi("/interview/submit-answer", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  reportViolation: (body: { session_id: string; violation_type: string; reason?: string }): Promise<{
    violations: number;
    warning: boolean;
    closed?: boolean;
    reason?: string;
    remaining?: number;
    report?: InterviewReportData;
  }> =>
    fetchApi("/interview/report-violation", {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
export type KbsRoleMatch = {
  score?: number;
  requestedRole?: string;
  matchedRole?: string | null;
  roleGroup?: string | null;
  compatibleRoles?: string[];
  roleScoresConsidered?: { role: string | null; score: number }[];
};
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
  jobs: (params?: { limit?: number }): Promise<{
    recommendations: {
      score: number;
      technicalScore?: number;
      knowledgeScore?: number;
      reason: string;
      matchedSkills: string[];
      missingSkills: string[];
      requiredSkills: string[];
      requiredDomains?: string[];
      bestRole?: string;
      bestRoleScore?: number;
      roleMatch?: KbsRoleMatch;
      roleMatches?: KbsRoleMatch[];
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
    params?: { limit?: number }
  ): Promise<{
    recommendations: {
      score: number;
      technicalScore?: number;
      knowledgeScore?: number;
      reason: string;
      matchedSkills: string[];
      missingSkills: string[];
      requiredSkills: string[];
      requiredDomains?: string[];
      bestRole?: string;
      bestRoleScore?: number;
      roleMatch?: KbsRoleMatch;
      roleMatches?: KbsRoleMatch[];
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
    params?: { limit?: number; maxTeamSize?: number }
  ): Promise<{
    requiredSkills: string[];
    requiredDomains?: string[];
    requiredRoles: { name: string; count: number }[];
    recommendations: {
      score: number;
      finalScore: number;
      technicalScore: number;
      knowledgeScore?: number;
      synergyScore: number;
      coverageScore: number;
      reason: string;
      coveredSkills: string[];
      missingSkills: string[];
      sharedEntities: string[];
      knowledgeKeywords?: string[];
      matchedKnowledgeSkills?: string[];
      matchedKnowledgeDomains?: string[];
      members: {
        userId: string;
        name: string;
        headline?: string;
        experienceLevel?: string;
        hourlyRate?: number;
        skills: string[];
        requestedRole?: string;
        coveredSkills: string[];
        bestRole?: string;
        bestRoleScore?: number;
        roleScore?: number;
        roleMatch?: KbsRoleMatch;
        matchedRole?: string | null;
        roleGroup?: string | null;
        domainKnowledge?: string[];
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
  syncFreelancer: (): Promise<{ kbsSync: ProjectData["kbsSync"]; result: unknown }> =>
    fetchApi("/kbs/freelancer/sync", { method: "POST" }),
  syncProject: (
    projectId: string
  ): Promise<{ kbsSync: ProjectData["kbsSync"]; result: unknown }> =>
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
