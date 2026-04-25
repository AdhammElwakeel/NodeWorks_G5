import type { Profile, Job, Proposal, EarningsData } from "./types";

export const MOCK_PROFILE: Profile = {
  name: "Ahmed Hassan",
  headline: "Senior Full-Stack Developer | React · Node.js · Python",
  role: "Senior",
  country: "Egypt",
  hourlyRate: 65,
  availability: "Full-time",
  about:
    "Passionate full-stack developer with 7+ years of experience building scalable web applications. Specialized in React ecosystems, Node.js microservices, and AI integration. Delivered 40+ successful projects for startups and enterprise clients across fintech, healthcare, and e-commerce sectors.\n\nI thrive in collaborative environments and love turning complex requirements into elegant, performant solutions. My approach combines clean architecture with pragmatic delivery — shipping quality code on time, every time.",
  skills: ["React", "Next.js", "TypeScript", "Node.js", "Python", "PostgreSQL", "Docker", "AWS", "GraphQL"],
  experienceLevel: "Senior",
  portfolioLinks: [
    "https://github.com/ahmeddev",
    "https://linkedin.com/in/ahmedhassan",
    "https://ahmedhassan.dev",
  ],
  completedJobs: 34,
  totalEarnings: 128500,
  memberSince: "2021",
  rating: 4.9,
  reviews: 28,
};

export const MOCK_JOBS: Job[] = [
  {
    id: "1",
    title: "Build AI-Powered SaaS Dashboard with Next.js",
    description:
      "We need a senior developer to build a modern SaaS analytics dashboard using Next.js 14, Tailwind CSS, and shadcn/ui. The dashboard will display real-time metrics, charts, and user management features. Experience with Recharts or D3.js preferred.",
    budget: 8500,
    budgetType: "fixed",
    skills: ["Next.js", "TypeScript", "Tailwind CSS", "Recharts"],
    clientName: "TechFlow Inc.",
    clientAvatar: "TF",
    postedAt: "2 hours ago",
    proposals: 12,
    saved: false,
  },
  {
    id: "2",
    title: "Node.js Microservices Architecture Refactor",
    description:
      "Our legacy monolithic backend needs to be broken down into microservices. We're looking for someone with deep Node.js and Docker experience to design and implement a service-oriented architecture using Fastify, PostgreSQL, and RabbitMQ.",
    budget: 12000,
    budgetType: "fixed",
    skills: ["Node.js", "Docker", "PostgreSQL", "Microservices"],
    clientName: "ScaleUp Labs",
    clientAvatar: "SU",
    postedAt: "5 hours ago",
    proposals: 8,
    saved: true,
  },
  {
    id: "3",
    title: "React Native Mobile App for Fitness Startup",
    description:
      "Develop a cross-platform fitness tracking app with social features. The app needs workout tracking, progress charts, social feeds, and integration with health APIs (Apple HealthKit / Google Fit). Clean UI/UX is critical.",
    budget: 45,
    budgetType: "hourly",
    skills: ["React Native", "TypeScript", "Mobile Development", "UI Design"],
    clientName: "FitPulse",
    clientAvatar: "FP",
    postedAt: "1 day ago",
    proposals: 24,
    saved: false,
  },
  {
    id: "4",
    title: "E-commerce Platform Migration to Headless Shopify",
    description:
      "Migrate our existing WooCommerce store to a headless Shopify + Next.js setup. We need custom storefront, optimized checkout flow, and integration with our existing inventory management system.",
    budget: 6000,
    budgetType: "fixed",
    skills: ["Shopify", "Next.js", "GraphQL", "E-commerce"],
    clientName: "Meridian Goods",
    clientAvatar: "MG",
    postedAt: "1 day ago",
    proposals: 15,
    saved: false,
  },
  {
    id: "5",
    title: "Python Data Pipeline & ML Model Deployment",
    description:
      "Build an end-to-end data pipeline that ingests user behavior data, processes it with Pandas/Polars, trains a recommendation model with scikit-learn, and deploys the model as a FastAPI microservice.",
    budget: 55,
    budgetType: "hourly",
    skills: ["Python", "Machine Learning", "FastAPI", "PostgreSQL"],
    clientName: "DataMind AI",
    clientAvatar: "DM",
    postedAt: "2 days ago",
    proposals: 6,
    saved: true,
  },
  {
    id: "6",
    title: "Real-time Collaborative Whiteboard (WebSockets + Canvas)",
    description:
      "Create a real-time collaborative whiteboard similar to Excalidraw or Miro Lite. Users can draw shapes, add sticky notes, and collaborate in real-time. WebSockets for real-time sync, Canvas API for rendering.",
    budget: 9500,
    budgetType: "fixed",
    skills: ["TypeScript", "WebSockets", "Canvas API", "React"],
    clientName: "CollabSpace",
    clientAvatar: "CS",
    postedAt: "3 days ago",
    proposals: 19,
    saved: false,
  },
];

export const MOCK_PROPOSALS: Proposal[] = [
  {
    id: "p1",
    projectTitle: "Build AI-Powered SaaS Dashboard with Next.js",
    status: "pending",
    coverLetter:
      "I have extensive experience with Next.js 14 and have built several SaaS dashboards with real-time analytics. My recent project for FinTech Corp used Recharts with WebSocket feeds...",
    proposedRate: 8500,
    submittedAt: "2 days ago",
  },
  {
    id: "p2",
    projectTitle: "Python Data Pipeline & ML Model Deployment",
    status: "accepted",
    coverLetter:
      "I've built 5+ ML pipelines in production using FastAPI, Polars, and scikit-learn. My approach focuses on reproducible pipelines with proper testing and monitoring...",
    proposedRate: 55,
    submittedAt: "1 week ago",
  },
  {
    id: "p3",
    projectTitle: "Real-time Collaborative Whiteboard",
    status: "rejected",
    coverLetter:
      "I built a similar whiteboard tool for a YC-backed startup last year. I used Yjs for CRDT-based collaboration and Canvas API with offscreen rendering for performance...",
    proposedRate: 9000,
    submittedAt: "2 weeks ago",
  },
];

export const MOCK_EARNINGS: EarningsData = {
  totalEarnings: 128500,
  thisMonth: 12400,
  pending: 3200,
  available: 8100,
  transactions: [
    { id: "t1", project: "SaaS Dashboard", client: "TechFlow Inc.", amount: 4250, date: "Apr 15, 2025", status: "completed" },
    { id: "t2", project: "API Integration", client: "CloudScale", amount: 1800, date: "Apr 10, 2025", status: "completed" },
    { id: "t3", project: "Mobile App UI", client: "FitPulse", amount: 3200, date: "Apr 5, 2025", status: "pending" },
    { id: "t4", project: "E-commerce Migration", client: "Meridian Goods", amount: 5600, date: "Mar 28, 2025", status: "completed" },
    { id: "t5", project: "ML Pipeline", client: "DataMind AI", amount: 2100, date: "Mar 20, 2025", status: "completed" },
    { id: "t6", project: "Whiteboard Tool", client: "CollabSpace", amount: 3800, date: "Mar 15, 2025", status: "completed" },
  ],
  monthlyStats: [
    { month: "Jan", earnings: 8200 },
    { month: "Feb", earnings: 9500 },
    { month: "Mar", earnings: 12100 },
    { month: "Apr", earnings: 12400 },
    { month: "May", earnings: 10800 },
    { month: "Jun", earnings: 13500 },
  ],
};
