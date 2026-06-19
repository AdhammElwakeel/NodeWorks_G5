import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Skill, seedSkills } from "@/lib/models";

export const runtime = "nodejs";

// In-memory cache: skills rarely change, so avoid hitting Mongo on every
// request. Invalidated when a new skill is added or after 5 minutes.
let cachedSkills: { id: string; name: string; category: string }[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Auto-seed only once per process lifetime, not on every request.
let seedingPromise: Promise<void> | null = null;

// GET /api/skills — list all skills
export async function GET() {
  try {
    await connectDB();

    // Seed once per process
    if (!seedingPromise) {
      seedingPromise = seedSkills().catch((err) => {
        console.error("Skills seed error:", err);
        seedingPromise = null;
      });
    }
    await seedingPromise;

    // Return cached result if fresh
    const now = Date.now();
    if (cachedSkills && now - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        { skills: cachedSkills },
        { headers: { "Cache-Control": "public, max-age=300" } }
      );
    }

    const skills = await Skill.find().sort({ category: 1, name: 1 }).lean();
    const formatted = skills.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      category: s.category,
    }));

    cachedSkills = formatted;
    cachedAt = now;

    return NextResponse.json(
      { skills: formatted },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch skills";
    console.error("Skills GET error:", message);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}