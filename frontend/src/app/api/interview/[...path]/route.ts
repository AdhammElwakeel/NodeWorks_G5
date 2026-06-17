import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const INTERVIEW_API_URL =
  process.env.AI_INTERVIEW_API_URL ||
  process.env.INTERVIEW_API_URL ||
  process.env.AI_INTERVIEW_URL ||
  "http://localhost:8001";

async function proxyToInterviewService(
  req: NextRequest,
  path: string[],
  method: string,
) {
  const endpoint = path.join("/");
  const url = `${INTERVIEW_API_URL.replace(/\/$/, "")}/api/interview/${endpoint}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const accept = req.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(method === "GET" ? 30_000 : 60_000),
  };

  if (method !== "GET" && method !== "HEAD") {
    const body = await req.text();
    if (body) {
      fetchOptions.body = body;
    }
  }

  try {
    const response = await fetch(url, fetchOptions);
    const contentTypeHeader = response.headers.get("content-type") || "";

    if (contentTypeHeader.includes("application/json")) {
      const data = await response
        .json()
        .catch(() => ({ detail: response.statusText }));
      return NextResponse.json(data, { status: response.status });
    }

    const text = await response.text().catch(() => "");
    return new NextResponse(text, { status: response.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error(`[interview proxy] ${method} /${endpoint} failed:`, message);
    return NextResponse.json(
      { detail: `Could not reach AI Interview API: ${message}` },
      { status: 502 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyToInterviewService(req, path, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyToInterviewService(req, path, "POST");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyToInterviewService(req, path, "PATCH");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyToInterviewService(req, path, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyToInterviewService(req, path, "DELETE");
}
