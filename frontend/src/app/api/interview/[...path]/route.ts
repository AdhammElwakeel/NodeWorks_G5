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

async function authorizeFreelancer(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "freelancer") return null;

  return payload;
}

async function proxyInterviewRequest(
  req: NextRequest,
  params: Promise<{ path: string[] }>
) {
  try {
    const payload = await authorizeFreelancer(req);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const upstreamPath = path.join("/");
    const url = new URL(`${AI_API_BASE_URL}/api/interview/${upstreamPath}`);
    req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

    const init: RequestInit = {
      method: req.method,
      headers: { "Content-Type": "application/json" },
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      const body: Record<string, unknown> = await req.json().catch(() => ({}));
      if (upstreamPath === "start") {
        body.candidate_id = payload.userId;
      }
      init.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);

    const data = await parseApiResponse(response);
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.detail ||
            data.error ||
            `Interview service returned HTTP ${response.status}`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to reach the AI interview service.",
        detail: message,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyInterviewRequest(req, params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyInterviewRequest(req, params);
}
