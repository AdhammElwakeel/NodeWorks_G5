import mongoose from "mongoose";

export interface IProposal {
  _id: string;
  projectId: mongoose.Types.ObjectId;
  freelancerId: mongoose.Types.ObjectId;
  coverLetter: string;
  proposedRate: number;
  estimatedDuration?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const ProposalSchema = new mongoose.Schema<IProposal>(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    freelancerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coverLetter: {
      type: String,
      required: [true, "Cover letter is required"],
    },
    proposedRate: {
      type: Number,
      required: [true, "Proposed rate is required"],
      min: 1,
    },
    estimatedDuration: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate proposals from same freelancer on same project
ProposalSchema.index({ projectId: 1, freelancerId: 1 }, { unique: true });

export const Proposal =
  mongoose.models.Proposal || mongoose.model<IProposal>("Proposal", ProposalSchema);