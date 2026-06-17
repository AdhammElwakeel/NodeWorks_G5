import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || "http://localhost:8010";
const CV_ANALYSIS_API_URL = `${AI_API_BASE_URL}/api/analyze-cv`;

function cvAnalysisUrls() {
  const urls = [CV_ANALYSIS_API_URL];
  if (AI_API_BASE_URL.includes("//backend:")) {
    urls.push(`${AI_API_BASE_URL.replace("//backend:", "//localhost:")}/api/analyze-cv`);
  }
  if (AI_API_BASE_URL.includes("//localhost:")) {
    urls.push(`${AI_API_BASE_URL.replace("//localhost:", "//backend:")}/api/analyze-cv`);
  }
  return Array.from(new Set(urls));
}

export async function POST(req: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid form data";
      return NextResponse.json({ error: "Invalid CV upload form data", detail: message }, { status: 400 });
    }

    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing CV file" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }

    let response: Response | null = null;
    let reachedUrl = "";
    const attemptedUrls = cvAnalysisUrls();
    const connectionErrors: { url: string; detail: string }[] = [];

    for (const url of attemptedUrls) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      try {
        const upstreamForm = new FormData();
        upstreamForm.append("file", file, file.name);
        response = await fetch(url, {
          method: "POST",
          body: upstreamForm,
          signal: controller.signal,
        });
        reachedUrl = url;
        break;
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : "Unknown connection error";
        connectionErrors.push({ url, detail });
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!response) {
      return NextResponse.json(
        {
          error:
            "Failed to reach the CV analysis service. Make sure the Python API is running on port 8010.",
          attemptedUrls,
          connectionErrors,
        },
        { status: 502 }
      );
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const backendError = typeof data?.detail === "object" && data.detail !== null
        ? data.detail.error || data.detail.detail
        : data?.detail;
      return NextResponse.json(
        {
          error:
            backendError ||
            data?.error ||
            `CV analysis service returned HTTP ${response.status}`,
          upstreamUrl: CV_ANALYSIS_API_URL,
          reachedUrl,
          attemptedUrls,
          upstreamStatus: response.status,
          upstreamResponse: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ ...(data || {}), _debug: { reachedUrl, attemptedUrls } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error:
          "Failed to reach the CV analysis service. Make sure the Python API is running on port 8010.",
        detail: message,
        upstreamUrl: CV_ANALYSIS_API_URL,
        attemptedUrls: cvAnalysisUrls(),
      },
      { status: 502 }
    );
  }
}
