import { Skill, seedSkills } from "@/lib/models";

type LibrarySkill = {
  name: string;
};

const ALIASES: Record<string, string> = {
  ai: "Machine Learning",
  css: "HTML/CSS",
  html: "HTML/CSS",
  htmlcss: "HTML/CSS",
  js: "JavaScript",
  javascript: "JavaScript",
  ml: "Machine Learning",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  next: "Next.js",
  nextjs: "Next.js",
  node: "Node.js",
  nodejs: "Node.js",
  postgres: "PostgreSQL",
  reactjs: "React",
  tailwind: "Tailwind CSS",
  ts: "TypeScript",
  typescript: "TypeScript",
  // New aliases
  express: "Express.js",
  expressjs: "Express.js",
  nest: "NestJS",
  nestjs: "NestJS",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  springboot: "Spring Boot",
  dotnet: ".NET",
  csharp: "C#",
  golang: "Go",
  rails: "Ruby on Rails",
  ror: "Ruby on Rails",
  php: "PHP",
  laravel: "Laravel",
  kotlin: "Kotlin",
  rust: "Rust",
  grpc: "gRPC",
  websocket: "WebSockets",
  websockets: "WebSockets",
  jwt: "JWT",
  oauth: "OAuth",
  sqlite: "SQLite",
  dynamodb: "DynamoDB",
  elastic: "Elasticsearch",
  elasticsearch: "Elasticsearch",
  prisma: "Prisma",
  mongoose: "Mongoose",
  gcp: "Google Cloud",
  googlecloud: "Google Cloud",
  azure: "Azure",
  terraform: "Terraform",
  ansible: "Ansible",
  jenkins: "Jenkins",
  githubactions: "GitHub Actions",
  nginx: "Nginx",
  linux: "Linux",
  bash: "Shell Scripting",
  shell: "Shell Scripting",
  vercel: "Vercel",
  netlify: "Netlify",
  heroku: "Heroku",
  swift: "Swift",
  swiftui: "SwiftUI",
  dart: "Dart",
  expo: "Expo",
  ionic: "Ionic",
  pytorch: "PyTorch",
  nlp: "Natural Language Processing",
  cv: "Computer Vision",
  dl: "Deep Learning",
  deeplearning: "Deep Learning",
  pandas: "Pandas",
  numpy: "NumPy",
  openai: "OpenAI API",
  langchain: "LangChain",
  powerbi: "Power BI",
  tableau: "Tableau",
  spark: "Apache Spark",
  jest: "Jest",
  cypress: "Cypress",
  playwright: "Playwright",
  selenium: "Selenium",
  qa: "QA",
  ux: "UX Design",
  uxdesign: "UX Design",
  ui: "UI Design",
  uidesign: "UI Design",
  photoshop: "Adobe Photoshop",
  illustrator: "Adobe Illustrator",
  xd: "Adobe XD",
  sketch: "Sketch",
  canva: "Canva",
  figma: "Figma",
  solidity: "Solidity",
  ethereum: "Ethereum",
  web3: "Web3.js",
  nft: "NFT Development",
  wordpress: "WordPress",
  wp: "WordPress",
  shopify: "Shopify",
  strapi: "Strapi",
  woocommerce: "WooCommerce",
  magento: "Magento",
  seo: "SEO",
  ga: "Google Analytics",
  googleanalytics: "Google Analytics",
  agile: "Agile",
  scrum: "Scrum",
  git: "Git",
  cpp: "C++",
  cplusplus: "C++",
  matlab: "MATLAB",
  iot: "IoT",
  unity: "Unity",
  unreal: "Unreal Engine",
  ue: "Unreal Engine",
  stripe: "Stripe",
  firebase: "Firebase",
  supabase: "Supabase",
  redux: "Redux",
  zustand: "Zustand",
  vite: "Vite",
  webpack: "Webpack",
  sass: "Sass/SCSS",
  scss: "Sass/SCSS",
  bootstrap: "Bootstrap",
  mui: "Material UI",
  materialui: "Material UI",
  svelte: "Svelte",
  sveltekit: "SvelteKit",
  nuxt: "Nuxt.js",
  nuxtjs: "Nuxt.js",
  gatsby: "Gatsby",
  astro: "Astro",
  remix: "Remix",
  d3: "D3.js",
  threejs: "Three.js",
  jquery: "jQuery",
  storybook: "Storybook",
  neo4j: "Neo4j",
  cassandra: "Cassandra",
  redis: "Redis",
  cloudflare: "Cloudflare",
  digitalocean: "DigitalOcean",
};

function normalizeSkill(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9+#]+/g, "");
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_unused, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function similarity(a: string, b: string) {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  return 1 - levenshtein(a, b) / longer;
}

function findClosestSkill(input: string, library: LibrarySkill[]) {
  const normalized = normalizeSkill(input);
  if (!normalized) return null;

  const alias = ALIASES[normalized];
  if (alias) {
    const canonicalAlias = library.find(
      (skill) => normalizeSkill(skill.name) === normalizeSkill(alias)
    );
    if (canonicalAlias) return canonicalAlias.name;
  }

  const exact = library.find((skill) => normalizeSkill(skill.name) === normalized);
  if (exact) return exact.name;

  let best: { name: string; score: number; distance: number } | null = null;
  for (const skill of library) {
    const candidate = normalizeSkill(skill.name);
    const distance = levenshtein(normalized, candidate);
    const score = similarity(normalized, candidate);

    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { name: skill.name, score, distance };
    }
  }

  if (!best) return null;

  const threshold = normalized.length <= 4 ? 0.86 : 0.72;
  const maxDistance = normalized.length <= 4 ? 1 : 4;
  return best.score >= threshold && best.distance <= maxDistance ? best.name : null;
}

export async function matchSkillsToLibrary(values: unknown) {
  if (!Array.isArray(values)) return [];

  await seedSkills();
  const library = await Skill.find().select("name").lean<LibrarySkill[]>();
  const seen = new Set<string>();
  const matched: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const skill = findClosestSkill(value, library);
    if (!skill) continue;

    const key = normalizeSkill(skill);
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push(skill);
  }

  return matched;
}
