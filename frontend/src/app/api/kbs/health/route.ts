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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reach AI KBS API" },
      { status: 503 }
    );
  }
}
