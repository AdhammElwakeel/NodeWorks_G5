import { Skill } from "@/lib/models";

function cleanSkillList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const value of values) {
    const skill = typeof value === "string" ? value.trim() : "";
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(skill);
  }
  return cleaned;
}

function skillKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

const SKILL_ALIASES: Record<string, string> = {
  reactjs: "react",
  nextjs: "nextjs",
  nodejs: "nodejs",
  vuejs: "vuejs",
  tailwindcss: "tailwindcss",
  htmlcss: "htmlcss",
  postgres: "postgresql",
  postgresql: "postgresql",
  restapi: "restapi",
  llms: "llm",
  largelanguagemodels: "llm",
  largelanguagemodel: "llm",
  openaiapi: "openaiapi",
};

function canonicalSkillKey(value: string) {
  const key = skillKey(value);
  return SKILL_ALIASES[key] || key;
}

function cvSkillValues(profile: Record<string, unknown>) {
  const cvAnalysis = profile.cvAnalysis as Record<string, unknown> | undefined;
  return cleanSkillList([
    ...cleanSkillList(profile.skills),
    ...cleanSkillList(cvAnalysis?.allSkills),
    ...cleanSkillList(cvAnalysis?.all_skills),
  ]);
}

export async function upsertProfileSkillsIntoCatalog(profile: Record<string, unknown>) {
  const skills = cvSkillValues(profile);
  if (skills.length === 0) return { inserted: 0 };

  const existing = await Skill.find({}).select("name").lean();
  const existingKeys = new Set(
    existing.map((skill: { name?: string }) => canonicalSkillKey(skill.name || ""))
  );

  const newSkills: string[] = [];
  for (const skill of skills) {
    const key = canonicalSkillKey(skill);
    if (!key || existingKeys.has(key)) continue;
    existingKeys.add(key);
    newSkills.push(skill);
  }

  if (newSkills.length === 0) return { inserted: 0 };

  await Skill.insertMany(
    newSkills.map((name) => ({ name, category: "CV Extracted" })),
    { ordered: false }
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("duplicate key")) throw error;
  });

  return { inserted: newSkills.length };
}
