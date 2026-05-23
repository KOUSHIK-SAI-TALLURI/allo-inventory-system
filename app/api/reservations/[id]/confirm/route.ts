// app/api/reservations/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdempotencyResult, setIdempotencyResult } from "@/lib/redis";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ─── Idempotency (Bonus) ────────────────────────────────────────────
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await getIdempotencyResult(`confirm:${idempotencyKey}`);
      if (cached) {
        const cachedResponse = JSON.parse(cached);
        return NextResponse.json(cachedResponse.body, {
          status: cachedResponse.status,
          headers: { "X-Idempotent-Replayed": "true" },
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: params.id },
        include: { product: true, warehouse: true },
      });

      if (!reservation) {
        return { ok: false, reason: "not_found" } as const;
      }

      if (reservation.status === "CONFIRMED") {
        return { ok: true, reservation, alreadyConfirmed: true } as const;
      }

      if (reservation.status === "RELEASED") {
        return { ok: false, reason: "already_released" } as const;
      }

      // Check expiry
      if (reservation.expiresAt < new Date()) {
        // Release the held units
        await tx.stockLevel.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: { reservedUnits: { decrement: reservation.quantity } },
        });

        await tx.reservation.update({
          where: { id: params.id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });

        return { ok: false, reason: "expired" } as const;
      }

      // Confirm: decrement totalUnits and reservedUnits (the units are now sold)
      await tx.stockLevel.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: {
          totalUnits: { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity },
        },
      });

      const updated = await tx.reservation.update({
        where: { id: params.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        include: { product: true, warehouse: true },
      });

      return { ok: true, reservation: updated, alreadyConfirmed: false } as const;
    });

    if (!result.ok) {
      const status = result.reason === "expired" ? 410 : result.reason === "not_found" ? 404 : 400;
      const messages: Record<string, string> = {
        expired: "Reservation has expired. The hold has been released.",
        not_found: "Reservation not found.",
        already_released: "Reservation was already released.",
      };
      const responseBody = { error: messages[result.reason] ?? "Unknown error" };

      if (idempotencyKey) {
        await setIdempotencyResult(
          `confirm:${idempotencyKey}`,
          JSON.stringify({ body: responseBody, status })
        );
      }

      return NextResponse.json(responseBody, { status });
    }

    const { reservation } = result;
    const responseBody = {
      id: reservation.id,
      status: reservation.status,
      productName: reservation.product.name,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
    };

    if (idempotencyKey) {
      await setIdempotencyResult(
        `confirm:${idempotencyKey}`,
        JSON.stringify({ body: responseBody, status: 200 })
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("[POST /api/reservations/:id/confirm]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
