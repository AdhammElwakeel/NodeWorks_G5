import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const CV_ANALYSIS_API_URL =
  process.env.CV_ANALYSIS_API_URL ||
  process.env.NEXT_PUBLIC_CV_ANALYSIS_API_URL ||
  "http://localhost:8000/api/analyze-cv";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CV file" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, file.name);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const response = await fetch(CV_ANALYSIS_API_URL, {
      method: "POST",
      body: upstreamForm,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.error ||
            `CV analysis service returned HTTP ${response.status}`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error:
          "Failed to reach the CV analysis service. Make sure the Python API is running on port 8000.",
        detail: message,
      },
      { status: 502 }
    );
  }
}
