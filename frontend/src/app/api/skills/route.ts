import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Skill, seedSkills } from "@/lib/models";

// GET /api/skills — list all skills (optionally auto-seed)
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    // Auto-seed if empty
    await seedSkills();

    const skills = await Skill.find().sort({ category: 1, name: 1 }).lean();

    return NextResponse.json({
      skills: skills.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        category: s.category,
      })),
    });
  } catch (error: any) {
    console.error("Skills GET error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}