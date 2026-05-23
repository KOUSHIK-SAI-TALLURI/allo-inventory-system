// lib/expiry.ts
import { prisma } from "./prisma";

/**
 * Releases all PENDING reservations that have passed their expiresAt time.
 * Called lazily on reads AND via cron job in production.
 *
 * Uses a Prisma transaction to atomically:
 * 1. Find all expired PENDING reservations
 * 2. Decrement reservedUnits on corresponding StockLevel rows
 * 3. Mark reservations as RELEASED
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (expired.length === 0) return 0;

  // Batch release in a transaction
  await prisma.$transaction(async (tx) => {
    // Mark all as released
    await tx.reservation.updateMany({
      where: { id: { in: expired.map((r) => r.id) } },
      data: { status: "RELEASED", releasedAt: now },
    });

    // Decrement reservedUnits per (product, warehouse) group
    const grouped = new Map<string, number>();
    for (const r of expired) {
      const key = `${r.productId}__${r.warehouseId}`;
      grouped.set(key, (grouped.get(key) ?? 0) + r.quantity);
    }

    for (const [key, qty] of grouped.entries()) {
      const [productId, warehouseId] = key.split("__");
      await tx.stockLevel.updateMany({
        where: { productId, warehouseId },
        data: { reservedUnits: { decrement: qty } },
      });
    }
  });

  return expired.length;
}
