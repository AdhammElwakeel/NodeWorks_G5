import { NextResponse } from "next/server";
import { BACKEND_MISMATCH_NOTICE } from "@/lib/backend-features";

export async function GET() {
  return NextResponse.json(
    { items: [], error: BACKEND_MISMATCH_NOTICE, disabled: true },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: BACKEND_MISMATCH_NOTICE, disabled: true },
    { status: 501 }
  );
}
