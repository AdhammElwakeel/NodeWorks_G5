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
    { name: "Nuxt.js", category: "Frontend" },
    { name: "Angular", category: "Frontend" },
    { name: "Svelte", category: "Frontend" },
    { name: "SvelteKit", category: "Frontend" },
    { name: "TypeScript", category: "Frontend" },
    { name: "JavaScript", category: "Frontend" },
    { name: "HTML/CSS", category: "Frontend" },
    { name: "Tailwind CSS", category: "Frontend" },
    { name: "Bootstrap", category: "Frontend" },
    { name: "Material UI", category: "Frontend" },
    { name: "Sass/SCSS", category: "Frontend" },
    { name: "Redux", category: "Frontend" },
    { name: "Zustand", category: "Frontend" },
    { name: "Webpack", category: "Frontend" },
    { name: "Vite", category: "Frontend" },
    { name: "jQuery", category: "Frontend" },
    { name: "D3.js", category: "Frontend" },
    { name: "Three.js", category: "Frontend" },
    { name: "Storybook", category: "Frontend" },
    { name: "Gatsby", category: "Frontend" },
    { name: "Astro", category: "Frontend" },
    { name: "Remix", category: "Frontend" },

    // Backend
    { name: "Node.js", category: "Backend" },
    { name: "Express.js", category: "Backend" },
    { name: "NestJS", category: "Backend" },
    { name: "Python", category: "Backend" },
    { name: "Django", category: "Backend" },
    { name: "Flask", category: "Backend" },
    { name: "FastAPI", category: "Backend" },
    { name: "Java", category: "Backend" },
    { name: "Spring Boot", category: "Backend" },
    { name: "C#", category: "Backend" },
    { name: ".NET", category: "Backend" },
    { name: "Go", category: "Backend" },
    { name: "Rust", category: "Backend" },
    { name: "Ruby", category: "Backend" },
    { name: "Ruby on Rails", category: "Backend" },
    { name: "PHP", category: "Backend" },
    { name: "Laravel", category: "Backend" },
    { name: "Elixir", category: "Backend" },
    { name: "Scala", category: "Backend" },
    { name: "Kotlin", category: "Backend" },
    { name: "REST API", category: "Backend" },
    { name: "GraphQL", category: "Backend" },
    { name: "gRPC", category: "Backend" },
    { name: "Microservices", category: "Backend" },
    { name: "WebSockets", category: "Backend" },
    { name: "OAuth", category: "Backend" },
    { name: "JWT", category: "Backend" },

    // Database
    { name: "MongoDB", category: "Database" },
    { name: "PostgreSQL", category: "Database" },
    { name: "MySQL", category: "Database" },
    { name: "Redis", category: "Database" },
    { name: "SQLite", category: "Database" },
    { name: "Firebase", category: "Database" },
    { name: "Supabase", category: "Database" },
    { name: "DynamoDB", category: "Database" },
    { name: "Elasticsearch", category: "Database" },
    { name: "Cassandra", category: "Database" },
    { name: "Neo4j", category: "Database" },
    { name: "Prisma", category: "Database" },
    { name: "Mongoose", category: "Database" },
    { name: "SQL", category: "Database" },

    // DevOps & Cloud
    { name: "Docker", category: "DevOps" },
    { name: "AWS", category: "DevOps" },
    { name: "CI/CD", category: "DevOps" },
    { name: "Kubernetes", category: "DevOps" },
    { name: "Google Cloud", category: "DevOps" },
    { name: "Azure", category: "DevOps" },
    { name: "Terraform", category: "DevOps" },
    { name: "Ansible", category: "DevOps" },
    { name: "Jenkins", category: "DevOps" },
    { name: "GitHub Actions", category: "DevOps" },
    { name: "Nginx", category: "DevOps" },
    { name: "Linux", category: "DevOps" },
    { name: "Shell Scripting", category: "DevOps" },
    { name: "Vercel", category: "DevOps" },
    { name: "Netlify", category: "DevOps" },
    { name: "Heroku", category: "DevOps" },
    { name: "DigitalOcean", category: "DevOps" },
    { name: "Cloudflare", category: "DevOps" },

    // Mobile
    { name: "React Native", category: "Mobile" },
    { name: "Flutter", category: "Mobile" },
    { name: "iOS", category: "Mobile" },
    { name: "Android", category: "Mobile" },
    { name: "Swift", category: "Mobile" },
    { name: "SwiftUI", category: "Mobile" },
    { name: "Dart", category: "Mobile" },
    { name: "Expo", category: "Mobile" },
    { name: "Ionic", category: "Mobile" },

    // Data & AI
    { name: "Machine Learning", category: "Data & AI" },
    { name: "Data Analysis", category: "Data & AI" },
    { name: "TensorFlow", category: "Data & AI" },
    { name: "PyTorch", category: "Data & AI" },
    { name: "Natural Language Processing", category: "Data & AI" },
    { name: "Computer Vision", category: "Data & AI" },
    { name: "Deep Learning", category: "Data & AI" },
    { name: "Data Science", category: "Data & AI" },
    { name: "Pandas", category: "Data & AI" },
    { name: "NumPy", category: "Data & AI" },
    { name: "OpenAI API", category: "Data & AI" },
    { name: "LangChain", category: "Data & AI" },
    { name: "Data Visualization", category: "Data & AI" },
    { name: "Power BI", category: "Data & AI" },
    { name: "Tableau", category: "Data & AI" },
    { name: "R", category: "Data & AI" },
    { name: "Apache Spark", category: "Data & AI" },

    // Testing & QA
    { name: "Jest", category: "Testing" },
    { name: "Cypress", category: "Testing" },
    { name: "Playwright", category: "Testing" },
    { name: "Selenium", category: "Testing" },
    { name: "Unit Testing", category: "Testing" },
    { name: "Integration Testing", category: "Testing" },
    { name: "QA", category: "Testing" },

    // Design
    { name: "UI Design", category: "Design" },
    { name: "UX Design", category: "Design" },
    { name: "Figma", category: "Design" },
    { name: "Adobe XD", category: "Design" },
    { name: "Sketch", category: "Design" },
    { name: "Adobe Photoshop", category: "Design" },
    { name: "Adobe Illustrator", category: "Design" },
    { name: "Canva", category: "Design" },
    { name: "Wireframing", category: "Design" },
    { name: "Prototyping", category: "Design" },
    { name: "Responsive Design", category: "Design" },
    { name: "Graphic Design", category: "Design" },
    { name: "Motion Graphics", category: "Design" },
    { name: "Video Editing", category: "Design" },

    // Security
    { name: "Cybersecurity", category: "Security" },
    { name: "Penetration Testing", category: "Security" },
    { name: "Network Security", category: "Security" },
    { name: "OWASP", category: "Security" },

    // Blockchain & Web3
    { name: "Solidity", category: "Blockchain" },
    { name: "Ethereum", category: "Blockchain" },
    { name: "Smart Contracts", category: "Blockchain" },
    { name: "Web3.js", category: "Blockchain" },
    { name: "NFT Development", category: "Blockchain" },

    // CMS & E-commerce
    { name: "WordPress", category: "CMS" },
    { name: "Shopify", category: "CMS" },
    { name: "Strapi", category: "CMS" },
    { name: "Contentful", category: "CMS" },
    { name: "WooCommerce", category: "CMS" },
    { name: "Magento", category: "CMS" },

    // Marketing & Business
    { name: "SEO", category: "Marketing" },
    { name: "Google Analytics", category: "Marketing" },
    { name: "Social Media Marketing", category: "Marketing" },
    { name: "Email Marketing", category: "Marketing" },
    { name: "Copywriting", category: "Marketing" },
    { name: "PPC Advertising", category: "Marketing" },

    // Other
    { name: "Project Management", category: "Other" },
    { name: "Agile", category: "Other" },
    { name: "Scrum", category: "Other" },
    { name: "Content Writing", category: "Other" },
    { name: "Technical Writing", category: "Other" },
    { name: "E-commerce", category: "Other" },
    { name: "Webhooks", category: "Other" },
    { name: "Automation", category: "Other" },
    { name: "Stripe", category: "Other" },
    { name: "Payment Integration", category: "Other" },
    { name: "Git", category: "Other" },
    { name: "API Integration", category: "Other" },
    { name: "Web Scraping", category: "Other" },
    { name: "Chatbots", category: "Other" },
    { name: "System Design", category: "Other" },
    { name: "Data Structures", category: "Other" },
    { name: "Algorithms", category: "Other" },
    { name: "C++", category: "Other" },
    { name: "C", category: "Other" },
    { name: "MATLAB", category: "Other" },
    { name: "Assembly", category: "Other" },
    { name: "Embedded Systems", category: "Other" },
    { name: "IoT", category: "Other" },
    { name: "Game Development", category: "Other" },
    { name: "Unity", category: "Other" },
    { name: "Unreal Engine", category: "Other" },
  ];

  await Skill.insertMany(skills);
  console.log(`Seeded ${skills.length} skills`);
}