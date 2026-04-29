import { NextRequest, NextResponse } from "next/server";

const AI_INTERVIEW_URL =
  process.env.AI_INTERVIEW_URL ?? "http://localhost:8001";

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;
  const endpoint = path.join("/");
  const body = await req.text();

  try {
    const res = await fetch(`${AI_INTERVIEW_URL}/api/interview/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // Avoid connection hanging
      signal: AbortSignal.timeout(60_000),
    });

    const data = await res.json().catch(() => ({ detail: res.statusText }));
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error(`[interview proxy] POST /${endpoint} failed:`, message);
    return NextResponse.json(
      { detail: `Could not reach AI Interview API: ${message}` },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;
  const endpoint = path.join("/");

  try {
    const res = await fetch(`${AI_INTERVIEW_URL}/api/interview/${endpoint}`, {
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error(`[interview proxy] GET /${endpoint} failed:`, message);
    return NextResponse.json(
      { detail: `Could not reach AI Interview API: ${message}` },
      { status: 502 }
    );
  }
}
