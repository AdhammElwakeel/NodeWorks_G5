/** Shared Mongoose schema types used across multiple models. */

export interface IKbsSync {
  status: "not_synced" | "synced" | "outdated" | "failed";
  syncedAt?: Date;
  error?: string;
}

import mongoose from "mongoose";

export const KbsSyncSchema = new mongoose.Schema<IKbsSync>(
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
