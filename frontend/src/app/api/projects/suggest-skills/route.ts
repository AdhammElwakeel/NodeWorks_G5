import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || "http://localhost:8010";

async function parseApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (payload.role !== "client") {
      return NextResponse.json({ error: "Only clients can suggest project skills" }, { status: 403 });
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const skills = Array.isArray(body.skills) ? body.skills : [];

    if (!title || !description) {
      return NextResponse.json(
        { error: "Project title and description are required" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75_000);

    const response = await fetch(`${AI_API_BASE_URL}/projects/suggest-skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, skills }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await parseApiResponse(response);
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.detail ||
            data.error ||
            `Skill suggestion service returned HTTP ${response.status}`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ skills: Array.isArray(data.skills) ? data.skills : [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to reach the project skill suggestion service.",
        detail: message,
      },
      { status: 502 }
    );
  }
}
