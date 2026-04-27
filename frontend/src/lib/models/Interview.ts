import mongoose from "mongoose";

export interface IInterviewQuestion {
  question: string;
  type: "technical" | "soft-skills" | "communication";
  answer?: string;
  score?: number;
}

export interface IInterview {
  _id: string;
  userId: mongoose.Types.ObjectId;
  questions: IInterviewQuestion[];
  totalScore?: number;
  status: "pending" | "in-progress" | "completed";
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    type: {
      type: String,
      enum: ["technical", "soft-skills", "communication"],
      required: true,
    },
    answer: { type: String },
    score: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);

const InterviewSchema = new mongoose.Schema<IInterview>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    questions: [InterviewQuestionSchema],
    totalScore: { type: Number, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const Interview =
  mongoose.models.Interview ||
  mongoose.model<IInterview>("Interview", InterviewSchema);