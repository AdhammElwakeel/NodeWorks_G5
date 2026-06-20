import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
    sync: !args.has("--no-sync"),
  };
}

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

async function rescoreCv(aiApiBaseUrl, cvAnalysis) {
  const response = await fetch(`${aiApiBaseUrl}/api/rescore-cv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cvAnalysis }),
  });
  const result = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(result.detail || result.error || "CV rescore failed");
  }
  return result.cvAnalysis;
}

async function syncFreelancer(aiApiBaseUrl, user, profile, cvAnalysis) {
  const response = await fetch(`${aiApiBaseUrl}/kbs/freelancers/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      profile: {
        headline: profile.headline,
        experienceLevel: profile.experienceLevel,
        country: profile.country,
        skills: profile.skills || [],
        about: profile.about,
        hourlyRate: profile.hourlyRate,
        availability: profile.availability,
        portfolioLinks: profile.portfolioLinks || [],
        cvFileName: profile.cvFileName,
        cvAnalysis,
      },
    }),
  });
  const result = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(result.detail || result.error || "KBS freelancer sync failed");
  }
  return result;
}

const rootDir = path.resolve(import.meta.dirname, "..", "..");
const frontendDir = path.resolve(import.meta.dirname, "..");
loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(frontendDir, ".env"));

const { dryRun, sync } = parseArgs();
const mongoUri = process.env.MONGODB_URI;
const aiApiBaseUrl = process.env.AI_API_BASE_URL || "http://localhost:8010";

if (!mongoUri) {
  console.error("Missing MONGODB_URI. Set it in frontend/.env or the shell environment.");
  process.exit(1);
}

const looseSchema = new mongoose.Schema({}, { strict: false });
const FreelancerProfile = mongoose.model("RescoreFreelancerProfile", looseSchema, "freelancerprofiles");
const User = mongoose.model("RescoreUser", looseSchema, "users");

await mongoose.connect(mongoUri);

const profiles = await FreelancerProfile.find({ cvAnalysis: { $exists: true, $ne: null } }).lean();
let rescored = 0;
let synced = 0;
let failed = 0;
let skipped = 0;

for (const profile of profiles) {
  const user = await User.findById(profile.userId).lean();
  if (!user) {
    skipped += 1;
    console.warn(`skip profile ${profile._id}: user not found`);
    continue;
  }

  try {
    const cvAnalysis = await rescoreCv(aiApiBaseUrl, profile.cvAnalysis || {});
    rescored += 1;

    const bestRole = cvAnalysis.bestRole || "unknown role";
    const bestScore = cvAnalysis.bestScore ?? 0;
    console.log(`${dryRun ? "would update" : "updated"}: ${user.email || user._id} -> ${bestRole} (${bestScore})`);

    if (dryRun) continue;

    await FreelancerProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          cvAnalysis,
          "kbsSync.status": "outdated",
          "kbsSync.syncedAt": profile.kbsSync?.syncedAt,
        },
        $unset: { "kbsSync.error": "" },
      }
    );

    if (!sync) continue;

    await syncFreelancer(aiApiBaseUrl, user, profile, cvAnalysis);
    await FreelancerProfile.updateOne(
      { _id: profile._id },
      {
        $set: {
          "kbsSync.status": "synced",
          "kbsSync.syncedAt": new Date(),
        },
        $unset: { "kbsSync.error": "" },
      }
    );
    synced += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`failed ${user.email || user._id}: ${message}`);
    if (!dryRun) {
      await FreelancerProfile.updateOne(
        { _id: profile._id },
        {
          $set: {
            kbsSync: {
              status: "failed",
              syncedAt: profile.kbsSync?.syncedAt,
              error: message,
            },
          },
        }
      );
    }
  }
}

await mongoose.disconnect();

console.log(
  `done: profiles=${profiles.length}, rescored=${rescored}, synced=${synced}, skipped=${skipped}, failed=${failed}, dryRun=${dryRun}`
);

if (failed > 0) process.exit(1);
