import mongoose from "mongoose";

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  {
    timestamps: true,
  }
);

export const FreelancerProfile =
  mongoose.models.FreelancerProfile ||
  mongoose.model<IFreelancerProfile>("FreelancerProfile", FreelancerProfileSchema);
