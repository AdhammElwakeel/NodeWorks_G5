export type Section = "home" | "jobs" | "earnings";

export interface Profile {
  name: string;
  headline: string;
  role: string;
  country: string;
  hourlyRate: number;
  availability: string;
  about: string;
  skills: string[];
  experienceLevel: string;
  portfolioLinks: string[];
  completedJobs: number;
  totalEarnings: number;
  memberSince: string;
  rating: number;
  reviews: number;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  budget: number;
  budgetType: "fixed" | "hourly";
  skills: string[];
  clientName: string;
  clientAvatar: string;
  postedAt: string;
  proposals: number;
  saved: boolean;
}

export interface Proposal {
  id: string;
  projectTitle: string;
  status: "pending" | "accepted" | "rejected";
  coverLetter: string;
  proposedRate: number;
  submittedAt: string;
}

export interface Transaction {
  id: string;
  project: string;
  client: string;
  amount: number;
  date: string;
  status: "completed" | "pending";
}

export interface MonthlyStat {
  month: string;
  earnings: number;
}

export interface EarningsData {
  totalEarnings: number;
  thisMonth: number;
  pending: number;
  available: number;
  transactions: Transaction[];
  monthlyStats: MonthlyStat[];
}

export interface EditFormState {
  name: string;
  headline: string;
  about: string;
  country: string;
  hourlyRate: number;
  experienceLevel: string;
  availability: string;
  skills: string[];
  portfolioLinks: string[];
}
