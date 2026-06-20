import mongoose from "mongoose";

export interface ISkill {
  _id: string;
  name: string;
  category: string;
  createdAt: Date;
}

const SkillSchema = new mongoose.Schema<ISkill>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Skill =
  mongoose.models.Skill || mongoose.model<ISkill>("Skill", SkillSchema);

// Seed helper — call this once to populate initial skills
export async function seedSkills() {
  const count = await Skill.countDocuments();
  if (count > 0) return;

  const skills = [
    // Frontend
    { name: "React", category: "Frontend" },
    { name: "Next.js", category: "Frontend" },
    { name: "Vue.js", category: "Frontend" },
    { name: "Angular", category: "Frontend" },
    { name: "TypeScript", category: "Frontend" },
    { name: "JavaScript", category: "Frontend" },
    { name: "HTML/CSS", category: "Frontend" },
    { name: "Tailwind CSS", category: "Frontend" },
    { name: "UI Design", category: "Frontend" },
    { name: "Figma", category: "Frontend" },

    // Backend
    { name: "Node.js", category: "Backend" },
    { name: "Python", category: "Backend" },
    { name: "Java", category: "Backend" },
    { name: "C#", category: "Backend" },
    { name: "Go", category: "Backend" },
    { name: "REST API", category: "Backend" },
    { name: "GraphQL", category: "Backend" },
    { name: "Microservices", category: "Backend" },

    // Database
    { name: "MongoDB", category: "Database" },
    { name: "PostgreSQL", category: "Database" },
    { name: "MySQL", category: "Database" },
    { name: "Redis", category: "Database" },

    // DevOps
    { name: "Docker", category: "DevOps" },
    { name: "AWS", category: "DevOps" },
    { name: "CI/CD", category: "DevOps" },
    { name: "Kubernetes", category: "DevOps" },

    // Mobile
    { name: "React Native", category: "Mobile" },
    { name: "Flutter", category: "Mobile" },
    { name: "iOS", category: "Mobile" },
    { name: "Android", category: "Mobile" },

    // Data & AI
    { name: "Machine Learning", category: "Data & AI" },
    { name: "Data Analysis", category: "Data & AI" },
    { name: "TensorFlow", category: "Data & AI" },

    // Other
    { name: "Project Management", category: "Other" },
    { name: "Content Writing", category: "Other" },
    { name: "SEO", category: "Other" },
    { name: "E-commerce", category: "Other" },
    { name: "Webhooks", category: "Other" },
    { name: "Automation", category: "Other" },
  ];

  await Skill.insertMany(skills);
  console.log(`Seeded ${skills.length} skills`);
}
