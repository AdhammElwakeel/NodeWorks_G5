import mongoose from "mongoose";

export interface ICvExperienceItem {
  role?: string;
  company?: string;
  years?: string;
}

export interface ICvEducationItem {
  degree?: string;
  institution?: string;
  technologies?: string[];
}

export interface ICvProjectItem {
  name?: string;
  technologies?: string[];
}

export interface ICvRoleRanking {
  role: string;
  score: number;
  matchedSkills?: string[];
  missingSkills?: string[];
}

export interface ICvAnalysis {
  name?: string;
  email?: string;
  phone?: string;
  yearsOfExperience?: string;
  allSkills?: string[];
  experience?: ICvExperienceItem[];
  education?: ICvEducationItem[];
  projects?: ICvProjectItem[];
  certifications?: ICvProjectItem[];
  publications?: ICvProjectItem[];
  bestRole?: string;
  bestScore?: number;
  roleRankings?: ICvRoleRanking[];
  analyzedAt?: Date;
}

export interface IKbsSync {
  status: "not_synced" | "synced" | "outdated" | "failed";
  syncedAt?: Date;
  error?: string;
}

export interface IInterviewSkillScore {
  skill: string;
  score: number;
  questionsAsked: number;
}

export interface IInterviewResult {
  sessionId: string;
  overallScore: number;
  isVerified: boolean;
  totalQuestions: number;
  cheatingDetected: boolean;
  skillScores: IInterviewSkillScore[];
  completedAt: Date;
}

export interface IFreelancerProfile {
  _id: string;
  userId: mongoose.Types.ObjectId;
  headline?: string;
  experienceLevel?: "Junior" | "Mid-level" | "Senior" | "Lead";
  country?: string;
  skills: string[];
  about?: string;
  hourlyRate?: number;
  availability?: string;
  portfolioLinks?: string[];
  cvFileName?: string;
  cvStoragePath?: string;
  cvUploadedAt?: Date;
  cvAnalysis?: ICvAnalysis;
  kbsSync?: IKbsSync;
  interviewResult?: IInterviewResult;
  isVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const KbsSyncSchema = new mongoose.Schema<IKbsSync>(
  {
    status: {
      type: String,
      enum: ["not_synced", "synced", "outdated", "failed"],
      default: "not_synced",
    },
    syncedAt: { type: Date },
    error: { type: String },
  },
  { _id: false },
);

const InterviewSkillScoreSchema = new mongoose.Schema<IInterviewSkillScore>(
  {
    skill: { type: String, required: true, trim: true },
    score: { type: Number, required: true },
    questionsAsked: { type: Number, required: true },
  },
  { _id: false },
);

const InterviewResultSchema = new mongoose.Schema<IInterviewResult>(
  {
    sessionId: { type: String, required: true, trim: true },
    overallScore: { type: Number, required: true },
    isVerified: { type: Boolean, default: false },
    totalQuestions: { type: Number, required: true },
    cheatingDetected: { type: Boolean, default: false },
    skillScores: [InterviewSkillScoreSchema],
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const CvExperienceItemSchema = new mongoose.Schema<ICvExperienceItem>(
  {
    role: { type: String, trim: true },
    company: { type: String, trim: true },
    years: { type: String, trim: true },
  },
  { _id: false },
);

const CvEducationItemSchema = new mongoose.Schema<ICvEducationItem>(
  {
    degree: { type: String, trim: true },
    institution: { type: String, trim: true },
    technologies: [{ type: String, trim: true }],
  },
  { _id: false },
);

const CvProjectItemSchema = new mongoose.Schema<ICvProjectItem>(
  {
    name: { type: String, trim: true },
    technologies: [{ type: String, trim: true }],
  },
  { _id: false },
);

const CvRoleRankingSchema = new mongoose.Schema<ICvRoleRanking>(
  {
    role: { type: String, required: true, trim: true },
    score: { type: Number, required: true },
    matchedSkills: [{ type: String, trim: true }],
    missingSkills: [{ type: String, trim: true }],
  },
  { _id: false },
);

const CvAnalysisSchema = new mongoose.Schema<ICvAnalysis>(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    yearsOfExperience: { type: String, trim: true },
    allSkills: [{ type: String, trim: true }],
    experience: [CvExperienceItemSchema],
    education: [CvEducationItemSchema],
    projects: [CvProjectItemSchema],
    certifications: [CvProjectItemSchema],
    publications: [CvProjectItemSchema],
    bestRole: { type: String, trim: true },
    bestScore: { type: Number },
    roleRankings: [CvRoleRankingSchema],
    analyzedAt: { type: Date },
  },
  { _id: false },
);

const FreelancerProfileSchema = new mongoose.Schema<IFreelancerProfile>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    headline: { type: String, trim: true },
    experienceLevel: {
      type: String,
      enum: ["Junior", "Mid-level", "Senior", "Lead"],
    },
    country: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    about: { type: String },
    hourlyRate: { type: Number, min: 0 },
    availability: { type: String },
    portfolioLinks: [{ type: String, trim: true }],
    cvFileName: { type: String, trim: true },
    cvStoragePath: { type: String, trim: true },
    cvUploadedAt: { type: Date },
    cvAnalysis: CvAnalysisSchema,
    kbsSync: { type: KbsSyncSchema, default: () => ({ status: "not_synced" }) },
    interviewResult: InterviewResultSchema,
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

export const FreelancerProfile =
  mongoose.models.FreelancerProfile ||
  mongoose.model<IFreelancerProfile>(
    "FreelancerProfile",
    FreelancerProfileSchema,
  );
