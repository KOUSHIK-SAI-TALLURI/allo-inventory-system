// app/api/reservations/[id]/release/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: params.id },
        include: { product: true, warehouse: true },
      });

      if (!reservation) {
        return { ok: false, reason: "not_found" } as const;
      }

      if (reservation.status !== "PENDING") {
        return { ok: false, reason: "not_pending", currentStatus: reservation.status } as const;
      }

      // Release the reserved units back to available
      await tx.stockLevel.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: { reservedUnits: { decrement: reservation.quantity } },
      });

      const updated = await tx.reservation.update({
        where: { id: params.id },
        data: { status: "RELEASED", releasedAt: new Date() },
        include: { product: true, warehouse: true },
      });

      return { ok: true, reservation: updated } as const;
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
      }
      return NextResponse.json(
        {
          error: `Cannot release a reservation with status: ${result.currentStatus}`,
          currentStatus: result.currentStatus,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      id: result.reservation.id,
      status: result.reservation.status,
      releasedAt: result.reservation.releasedAt?.toISOString() ?? null,
      productName: result.reservation.product.name,
      quantity: result.reservation.quantity,
    });
  } catch (error) {
    console.error("[POST /api/reservations/:id/release]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
