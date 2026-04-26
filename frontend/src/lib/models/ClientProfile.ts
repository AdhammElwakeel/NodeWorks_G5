import mongoose from "mongoose";

export interface IClientProfile {
  _id: string;
  userId: mongoose.Types.ObjectId;
  companyName?: string;
  industry?: string;
  description?: string;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientProfileSchema = new mongoose.Schema<IClientProfile>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    companyName: { type: String, trim: true },
    industry: { type: String, trim: true },
    description: { type: String },
    website: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export const ClientProfile =
  mongoose.models.ClientProfile ||
  mongoose.model<IClientProfile>("ClientProfile", ClientProfileSchema);
