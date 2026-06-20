import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Skill, seedSkills } from "@/lib/models";

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

function skillKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

function canonicalizeSuggestedSkills(
  suggestions: string[],
  existingProjectSkills: string[],
  catalogSkills: string[]
) {
  const catalogByKey = new Map(catalogSkills.map((skill) => [skillKey(skill), skill]));
  const aliases: Record<string, string> = {
    reactjs: "React",
    nextjs: "Next.js",
    nodejs: "Node.js",
    vuejs: "Vue.js",
    angularjs: "Angular",
    tailwindcss: "Tailwind CSS",
    htmlcss: "HTML/CSS",
    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",
    mongodb: "MongoDB",
    restapi: "REST API",
    llms: "LLM",
    largelanguagemodels: "LLM",
    uiux: "UI/UX",
  };
  const existing = new Set(existingProjectSkills.map((skill) => skillKey(skill)));
  const seen = new Set<string>();

  return suggestions
    .map((skill) => {
      const trimmed = typeof skill === "string" ? skill.trim() : "";
      if (!trimmed) return "";
      const key = skillKey(trimmed);
      const alias = aliases[key];
      return (alias && catalogByKey.get(skillKey(alias))) || catalogByKey.get(key) || "";
    })
    .filter((skill) => {
      const key = skillKey(skill);
      if (!key || existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

    await connectDB();
    await seedSkills();
    const catalog = await Skill.find({}).select("name").lean();
    const catalogSkills = catalog.map((skill: any) => skill.name).filter(Boolean);

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

    const normalizedSkills = canonicalizeSuggestedSkills(
      Array.isArray(data.skills) ? data.skills : [],
      skills,
      catalogSkills
    );

    const domainKeywords = Array.isArray(data.domainKeywords) ? data.domainKeywords : [];

    return NextResponse.json({
      skills: normalizedSkills,
      domainKeywords,
      requiredRoles: Array.isArray(data.requiredRoles) ? data.requiredRoles : [],
      projectKeywords: [...normalizedSkills, ...domainKeywords],
    });
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
