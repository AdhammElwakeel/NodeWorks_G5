import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { syncFreelancerToKbs } from "@/lib/server/kbs-sync";

// POST /api/kbs/freelancer/sync — manually sync current freelancer profile to Neo4j
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (payload.role !== "freelancer") {
      return NextResponse.json({ error: "Only freelancers can sync this resource" }, { status: 403 });
    }

    const result = await syncFreelancerToKbs(payload.userId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to sync freelancer to KBS";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
