import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, FreelancerProfile, ClientProfile } from "@/lib/models";
import { verifyToken } from "@/lib/auth";
import { syncFreelancerToKbs } from "@/lib/server/kbs-sync";

async function getCurrentUser(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return User.findById(payload.userId);
}

// GET /api/users/profile — returns current user + their profile
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let profile = null;
    if (user.role === "freelancer") {
      profile = await FreelancerProfile.findOne({ userId: user._id });
    } else if (user.role === "client") {
      profile = await ClientProfile.findOne({ userId: user._id });
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        ...(profile && {
          freelancerProfile: user.role === "freelancer" ? profile : undefined,
          clientProfile: user.role === "client" ? profile : undefined,
        }),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Profile GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/users/profile — update current user or their profile
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Update User fields
    if (body.name !== undefined) user.name = body.name;
    if (body.avatar !== undefined) user.avatar = body.avatar;
    await user.save();

    // Update role-specific profile
    if (body.profile) {
      if (user.role === "freelancer") {
        const existingProfile = await FreelancerProfile.findOne({ userId: user._id });
        const profileUpdates = { ...body.profile };
        delete profileUpdates.kbsSync;

        if (existingProfile?.kbsSync?.status === "synced") {
          profileUpdates.kbsSync = {
            status: "outdated",
            syncedAt: existingProfile.kbsSync.syncedAt,
            error: undefined,
          };
        }

        await FreelancerProfile.findOneAndUpdate(
          { userId: user._id },
          { $set: profileUpdates },
          { upsert: true, new: true }
        );

        try {
          await syncFreelancerToKbs(user._id.toString());
        } catch (syncError) {
          console.warn("Freelancer auto KBS sync failed:", syncError instanceof Error ? syncError.message : syncError);
        }
      } else if (user.role === "client") {
        await ClientProfile.findOneAndUpdate(
          { userId: user._id },
          { $set: body.profile },
          { upsert: true, new: true }
        );
      }
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Profile PATCH error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
