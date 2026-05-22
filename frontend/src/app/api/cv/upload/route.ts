import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db";
import { FreelancerProfile } from "@/lib/models";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "freelancer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CV file" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "storage", "cv");
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${payload.userId}-${Date.now()}-${safeFileName(file.name)}`;
    const storagePath = path.join(uploadDir, fileName);
    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

    await FreelancerProfile.findOneAndUpdate(
      { userId: payload.userId },
      {
        $set: {
          cvFileName: file.name,
          cvStoragePath: storagePath,
          cvUploadedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      cv: {
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload CV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
