import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { FreelancerProfile, User } from "@/lib/models";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (payload.role !== "client") {
      return NextResponse.json({ error: "Only clients can view freelancer profiles" }, { status: 403 });
    }

    const { id } = await params;
    const [user, profile] = await Promise.all([
      User.findOne({ _id: id, role: "freelancer" }).lean(),
      FreelancerProfile.findOne({ userId: id }).lean(),
    ]);

    if (!user || !profile) {
      return NextResponse.json({ error: "Freelancer not found" }, { status: 404 });
    }

    return NextResponse.json({
      freelancer: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        headline: profile.headline,
        experienceLevel: profile.experienceLevel,
        country: profile.country,
        skills: profile.skills || [],
        about: profile.about,
        hourlyRate: profile.hourlyRate,
        availability: profile.availability,
        portfolioLinks: profile.portfolioLinks || [],
        cvAnalysis: profile.cvAnalysis
          ? {
              yearsOfExperience: profile.cvAnalysis.yearsOfExperience,
              domainKnowledge: profile.cvAnalysis.domainKnowledge || [],
              experience: profile.cvAnalysis.experience || [],
              projects: profile.cvAnalysis.projects || [],
              bestRole: profile.cvAnalysis.bestRole,
              bestScore: profile.cvAnalysis.bestScore,
            }
          : undefined,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load freelancer profile" },
      { status: 500 }
    );
  }
}
