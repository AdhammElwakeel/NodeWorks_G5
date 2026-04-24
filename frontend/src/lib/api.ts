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

// Auth
export const authApi = {
  register: (body: { email: string; password: string; name: string; role: "freelancer" | "client" }) =>
    fetchApi("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    fetchApi("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => fetchApi("/auth/me"),
};

// Profile
export const profileApi = {
  get: () => fetchApi("/users/profile"),
  update: (body: any) =>
    fetchApi("/users/profile", { method: "PATCH", body: JSON.stringify(body) }),
};

// CV
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
      if (!res.ok) throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
      return data;
    });
  },
  status: (id: string) => fetchApi(`/cv/status/${id}`),
};

// Recommendations
export const recApi = {
  get: (body: { context?: string; projectId?: string; limit?: number }) =>
    fetchApi("/recommendations", { method: "POST", body: JSON.stringify(body) }),
};

// Projects
export const projectApi = {
  list: (params?: { mine?: boolean; status?: string; search?: string; skill?: string }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString() : "";
    return fetchApi(`/projects${qs}`);
  },
  create: (body: any) =>
    fetchApi("/projects", { method: "POST", body: JSON.stringify(body) }),
};

// Proposals
export const proposalApi = {
  list: (params?: { projectId?: string; mine?: boolean }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString() : "";
    return fetchApi(`/proposals${qs}`);
  },
  create: (body: { projectId: string; coverLetter: string; proposedRate?: number; estimatedDuration?: string }) =>
    fetchApi("/proposals", { method: "POST", body: JSON.stringify(body) }),
  update: (body: { proposalId: string; status: "accepted" | "rejected" }) =>
    fetchApi("/proposals", { method: "PATCH", body: JSON.stringify(body) }),
};

// Messages
export const messageApi = {
  conversations: () => fetchApi("/messages"),
  getThread: (withUserId: string) => fetchApi(`/messages?with=${withUserId}`),
  send: (body: { receiverId: string; content: string }) =>
    fetchApi("/messages", { method: "POST", body: JSON.stringify(body) }),
};

// KBS
export const kbsApi = {
  list: (params?: { category?: string; search?: string; mine?: boolean }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as any).toString() : "";
    return fetchApi(`/kbs${qs}`);
  },
  getBySlug: (slug: string) => fetchApi(`/kbs?slug=${slug}`),
  create: (body: any) =>
    fetchApi("/kbs", { method: "POST", body: JSON.stringify(body) }),
};

// Skills
export const skillApi = {
  list: () => fetchApi("/skills"),
};

// Interviews
export const interviewApi = {
  list: () => fetchApi("/interviews"),
  create: () => fetchApi("/interviews", { method: "POST" }),
  submit: (body: { interviewId: string; responses: any[]; scores?: any }) =>
    fetchApi("/interviews", { method: "PATCH", body: JSON.stringify(body) }),
};
