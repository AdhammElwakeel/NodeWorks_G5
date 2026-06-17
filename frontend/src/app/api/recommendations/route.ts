import { NextResponse } from "next/server";
import { BACKEND_MISMATCH_NOTICE } from "@/lib/backend-features";

export async function POST() {
  return NextResponse.json(
    { recommendations: [], error: BACKEND_MISMATCH_NOTICE, disabled: true },
    { status: 501 }
  );
}
