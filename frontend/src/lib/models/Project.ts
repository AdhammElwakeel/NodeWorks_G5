import mongoose from "mongoose";
import { IKbsSync, KbsSyncSchema } from "./shared";

export type { IKbsSync };

export interface IProject {
  _id: string;
  clientId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  budget: number;
  skills: string[];
  hiringMode: "individual" | "team";
  status: "open" | "closed" | "in-progress";
  timeline?: string;
  kbsSync?: IKbsSync;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new mongoose.Schema<IProject>(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Project description is required"],
    },
    budget: {
      type: Number,
      required: [true, "Budget is required"],
      min: 1,
    },
    skills: [{ type: String, trim: true }],
    hiringMode: {
      type: String,
      enum: ["individual", "team"],
      default: "individual",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "closed", "in-progress"],
      default: "open",
      index: true,
    },
    timeline: { type: String, trim: true },
    kbsSync: { type: KbsSyncSchema, default: () => ({ status: "not_synced" }) },
  },
  {
    timestamps: true,
  }
);

// Text index for search
ProjectSchema.index({ title: "text", description: "text" });

export const Project =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);
