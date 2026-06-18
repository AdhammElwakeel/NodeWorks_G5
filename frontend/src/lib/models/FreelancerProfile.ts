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
  headline?: string;
  yearsOfExperience?: string;
  allSkills?: string[];
  experience?: ICvExperienceItem[];
  education?: ICvEducationItem[];
  projects?: ICvProjectItem[];
  certifications?: ICvProjectItem[];
  publications?: ICvProjectItem[];
  bestRole?: string;
  bestScore?: number;
  roleConfidenceStatus?: "confident" | "needs_user_input";
  roleConfidenceThreshold?: number;
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
  questions_asked?: number;
}

export interface IAiInterviewReport {
  session_id: string;
  candidate_id?: string;
  overall_score: number;
  raw_score?: number;
  is_verified: boolean;
  skill_scores: IInterviewSkillScore[];
  total_questions: number;
  cheating_detected?: boolean;
  violations?: number;
  violation_types?: string[];
  violation_reasons?: { type: string; reason: string; occurred_at: Date }[];
  english_score?: number;
  penalty?: number;
  strong_skills?: string[];
  badge_tier?: "gold" | "silver" | "bronze" | null;
  completed_at?: Date;
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
  aiInterviewReport?: IAiInterviewReport;
  kbsSync?: IKbsSync;
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
  { _id: false }
);

const CvExperienceItemSchema = new mongoose.Schema<ICvExperienceItem>(
  {
    role: { type: String, trim: true },
    company: { type: String, trim: true },
    years: { type: String, trim: true },
  },
  { _id: false }
);

const CvEducationItemSchema = new mongoose.Schema<ICvEducationItem>(
  {
    degree: { type: String, trim: true },
    institution: { type: String, trim: true },
    technologies: [{ type: String, trim: true }],
  },
  { _id: false }
);

const CvProjectItemSchema = new mongoose.Schema<ICvProjectItem>(
  {
    name: { type: String, trim: true },
    technologies: [{ type: String, trim: true }],
  },
  { _id: false }
);

const CvRoleRankingSchema = new mongoose.Schema<ICvRoleRanking>(
  {
    role: { type: String, required: true, trim: true },
    score: { type: Number, required: true },
    matchedSkills: [{ type: String, trim: true }],
    missingSkills: [{ type: String, trim: true }],
  },
  { _id: false }
);

const CvAnalysisSchema = new mongoose.Schema<ICvAnalysis>(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    headline: { type: String, trim: true },
    yearsOfExperience: { type: String, trim: true },
    allSkills: [{ type: String, trim: true }],
    experience: [CvExperienceItemSchema],
    education: [CvEducationItemSchema],
    projects: [CvProjectItemSchema],
    certifications: [CvProjectItemSchema],
    publications: [CvProjectItemSchema],
    bestRole: { type: String, trim: true },
    bestScore: { type: Number },
    roleConfidenceStatus: {
      type: String,
      enum: ["confident", "needs_user_input"],
    },
    roleConfidenceThreshold: { type: Number },
    roleRankings: [CvRoleRankingSchema],
    analyzedAt: { type: Date },
  },
  { _id: false }
);

const InterviewSkillScoreSchema = new mongoose.Schema<IInterviewSkillScore>(
  {
    skill: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    questions_asked: { type: Number, min: 0 },
  },
  { _id: false }
);

const AiInterviewReportSchema = new mongoose.Schema<IAiInterviewReport>(
  {
    session_id: { type: String, required: true, trim: true },
    candidate_id: { type: String, trim: true },
    overall_score: { type: Number, required: true, min: 0, max: 100 },
    raw_score: { type: Number, min: 0, max: 100 },
    is_verified: { type: Boolean, required: true },
    skill_scores: [InterviewSkillScoreSchema],
    total_questions: { type: Number, required: true, min: 0 },
    cheating_detected: { type: Boolean },
    violations: { type: Number, min: 0 },
    violation_types: [{ type: String, trim: true }],
    violation_reasons: [
      {
        type: { type: String, trim: true },
        reason: { type: String, trim: true },
        occurred_at: { type: Date },
        _id: false,
      },
    ],
    english_score: { type: Number, min: 0, max: 100 },
    penalty: { type: Number, min: 0, max: 100 },
    strong_skills: [{ type: String, trim: true }],
    badge_tier: { type: String, enum: ["gold", "silver", "bronze", null] },
    completed_at: { type: Date },
  },
  { _id: false }
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
    aiInterviewReport: AiInterviewReportSchema,
    kbsSync: { type: KbsSyncSchema, default: () => ({ status: "not_synced" }) },
  },
  {
    timestamps: true,
  }
);

export const FreelancerProfile =
  mongoose.models.FreelancerProfile ||
  mongoose.model<IFreelancerProfile>("FreelancerProfile", FreelancerProfileSchema);
