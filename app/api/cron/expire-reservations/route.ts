// app/api/cron/expire-reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/expiry";

// Called by Vercel Cron every minute: see vercel.json
export async function GET(request: NextRequest) {
  // Protect the cron endpoint
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseExpiredReservations();
    return NextResponse.json({
      ok: true,
      releasedCount: released,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON expire-reservations]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
