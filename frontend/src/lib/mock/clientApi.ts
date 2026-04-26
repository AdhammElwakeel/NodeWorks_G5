"use client";

// ─── Types ───────────────────────────────────────────────────────────────

export interface ClientProject {
  id: string;
  title: string;
  description: string;
  budget: number;
  skills: string[];
  status: "open" | "closed" | "pending";
  createdAt: string;
  timeline?: string;
  proposalsCount: number;
}

export interface Proposal {
  id: string;
  projectId: string;
  freelancerName: string;
  freelancerAvatar?: string;
  freelancerSkills: string[];
  freelancerRating: number;
  coverLetter: string;
  proposedRate: number;
  status: "pending" | "accepted" | "rejected";
  submittedAt: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────

let MOCK_PROJECTS: ClientProject[] = [
  {
    id: "proj-1",
    title: "Build E-commerce Website",
    description:
      "Need a full-stack developer to build a modern e-commerce platform with React, Node.js, and Stripe integration. Must include admin dashboard, product catalog, cart, checkout, and order management.",
    budget: 5000,
    skills: ["React", "Node.js", "Stripe", "MongoDB", "TypeScript"],
    status: "open",
    createdAt: "2026-04-20T10:00:00Z",
    timeline: "4 weeks",
    proposalsCount: 3,
  },
  {
    id: "proj-2",
    title: "Mobile App UI/UX Design",
    description:
      "Looking for a talented UI/UX designer to redesign our fitness tracking mobile app. Need wireframes, high-fidelity mockups, and a design system in Figma.",
    budget: 2500,
    skills: ["Figma", "UI Design", "Mobile Design", "Prototyping"],
    status: "open",
    createdAt: "2026-04-22T14:30:00Z",
    timeline: "2 weeks",
    proposalsCount: 2,
  },
  {
    id: "proj-3",
    title: "Data Analytics Dashboard",
    description:
      "Build a real-time analytics dashboard for our SaaS product. Must connect to PostgreSQL, display charts, filters, and export capabilities. Experience with D3.js or Chart.js preferred.",
    budget: 4000,
    skills: ["React", "D3.js", "PostgreSQL", "Python", "Data Visualization"],
    status: "closed",
    createdAt: "2026-04-15T09:00:00Z",
    timeline: "3 weeks",
    proposalsCount: 0,
  },
  {
    id: "proj-4",
    title: "API Integration & Automation",
    description:
      "Integrate our CRM with third-party tools (Slack, Google Sheets, Zapier alternatives). Build webhook handlers and automated workflows.",
    budget: 1800,
    skills: ["Node.js", "REST API", "Webhooks", "Automation"],
    status: "open",
    createdAt: "2026-04-24T16:00:00Z",
    timeline: "1 week",
    proposalsCount: 1,
  },
];

let MOCK_PROPOSALS: Proposal[] = [
  {
    id: "prop-1",
    projectId: "proj-1",
    freelancerName: "Ahmed Hassan",
    freelancerSkills: ["React", "Node.js", "TypeScript", "MongoDB"],
    freelancerRating: 4.9,
    coverLetter:
      "I have 5+ years of experience building e-commerce platforms. I've worked with Stripe, Shopify APIs, and built custom checkout flows. I can deliver this in 3 weeks with daily updates.",
    proposedRate: 4500,
    status: "pending",
    submittedAt: "2026-04-21T08:00:00Z",
  },
  {
    id: "prop-2",
    projectId: "proj-1",
    freelancerName: "Sarah Mitchell",
    freelancerSkills: ["React", "Next.js", "Stripe", "Tailwind"],
    freelancerRating: 4.7,
    coverLetter:
      "I specialize in Next.js e-commerce solutions. I've built 3 production stores with Stripe and can provide references. My approach includes SEO optimization and performance tuning.",
    proposedRate: 5200,
    status: "pending",
    submittedAt: "2026-04-22T11:30:00Z",
  },
  {
    id: "prop-3",
    projectId: "proj-1",
    freelancerName: "Mohamed Ali",
    freelancerSkills: ["Node.js", "Express", "MongoDB", "AWS"],
    freelancerRating: 4.5,
    coverLetter:
      "Full-stack developer with backend focus. I can handle the entire stack including deployment on AWS. I prefer Agile methodology with 2-week sprints.",
    proposedRate: 4800,
    status: "pending",
    submittedAt: "2026-04-23T15:00:00Z",
  },
  {
    id: "prop-4",
    projectId: "proj-2",
    freelancerName: "Lisa Chen",
    freelancerSkills: ["Figma", "UI Design", "Mobile Design", "Prototyping"],
    freelancerRating: 4.8,
    coverLetter:
      "UI/UX designer with a passion for fitness apps. I've designed for Nike Training Club and Strava competitors. I deliver pixel-perfect designs with interactive prototypes.",
    proposedRate: 2200,
    status: "pending",
    submittedAt: "2026-04-23T10:00:00Z",
  },
  {
    id: "prop-5",
    projectId: "proj-2",
    freelancerName: "Omar Khaled",
    freelancerSkills: ["Figma", "Adobe XD", "Design Systems", "User Research"],
    freelancerRating: 4.6,
    coverLetter:
      "I create design systems that scale. My process includes user interviews, wireframing, usability testing, and final handoff with developer documentation.",
    proposedRate: 2600,
    status: "pending",
    submittedAt: "2026-04-24T09:00:00Z",
  },
  {
    id: "prop-6",
    projectId: "proj-4",
    freelancerName: "David Park",
    freelancerSkills: ["Node.js", "Webhooks", "Automation", "Zapier"],
    freelancerRating: 4.4,
    coverLetter:
      "Automation specialist. I've built 50+ integrations for SaaS companies. I use n8n for visual workflow building and custom Node.js for complex logic.",
    proposedRate: 1500,
    status: "pending",
    submittedAt: "2026-04-25T08:00:00Z",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  return "proj-" + Math.random().toString(36).slice(2, 9);
}

// ─── API ─────────────────────────────────────────────────────────────────

export const clientApi = {
  // Projects
  async createProject(data: Omit<ClientProject, "id" | "createdAt" | "proposalsCount">): Promise<ClientProject> {
    await delay(600);
    const project: ClientProject = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      proposalsCount: 0,
    };
    MOCK_PROJECTS.unshift(project);
    return project;
  },

  async listMyProjects(): Promise<ClientProject[]> {
    await delay(400);
    return [...MOCK_PROJECTS];
  },

  async getProject(id: string): Promise<ClientProject | null> {
    await delay(300);
    return MOCK_PROJECTS.find((p) => p.id === id) || null;
  },

  async updateProject(
    id: string,
    data: Partial<Omit<ClientProject, "id" | "createdAt">>
  ): Promise<ClientProject> {
    await delay(500);
    const idx = MOCK_PROJECTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Project not found");
    MOCK_PROJECTS[idx] = { ...MOCK_PROJECTS[idx], ...data };
    return MOCK_PROJECTS[idx];
  },

  async closeProject(id: string): Promise<ClientProject> {
    await delay(400);
    const idx = MOCK_PROJECTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Project not found");
    MOCK_PROJECTS[idx] = { ...MOCK_PROJECTS[idx], status: "closed" };
    return MOCK_PROJECTS[idx];
  },

  // Proposals
  async listProjectProposals(projectId: string): Promise<Proposal[]> {
    await delay(500);
    return MOCK_PROPOSALS.filter((p) => p.projectId === projectId);
  },

  async updateProposalStatus(
    proposalId: string,
    status: "accepted" | "rejected"
  ): Promise<Proposal> {
    await delay(600);
    const idx = MOCK_PROPOSALS.findIndex((p) => p.id === proposalId);
    if (idx === -1) throw new Error("Proposal not found");
    MOCK_PROPOSALS[idx] = { ...MOCK_PROPOSALS[idx], status };
    return MOCK_PROPOSALS[idx];
  },
};
