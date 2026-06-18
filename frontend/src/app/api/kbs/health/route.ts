import { NextResponse } from "next/server";

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || "http://localhost:8010";

export async function GET() {
  try {
    const response = await fetch(`${AI_API_BASE_URL}/kbs/health`, {
      cache: "no-store",
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach AI KBS API";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
