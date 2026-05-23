import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  acquireLock,
  releaseLock,
  getIdempotencyResult,
  setIdempotencyResult,
} from "@/lib/redis";
import {
  ReserveSchema,
  RESERVATION_TTL_MINUTES,
} from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = ReserveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // Idempotency support
    const idempotencyKey = request.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      const cached = await getIdempotencyResult(idempotencyKey);

      if (cached) {
        const cachedResponse = JSON.parse(cached);

        return NextResponse.json(cachedResponse.body, {
          status: cachedResponse.status,
          headers: {
            "X-Idempotent-Replayed": "true",
          },
        });
      }
    }

    // Distributed lock
    const lockKey = `reserve:${productId}:${warehouseId}`;

    const lockToken = await acquireLock(lockKey, 8000);

    if (!lockToken) {
      return NextResponse.json(
        {
          error:
            "Too many concurrent requests for this item. Please retry.",
        },
        { status: 429 }
      );
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            totalUnits: number;
            reservedUnits: number;
          }>
        >`
          SELECT id, "totalUnits", "reservedUnits"
          FROM "StockLevel"
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `;

        const stock = rows[0];

        if (!stock) {
          return {
            ok: false,
            reason: "no_stock_record",
          } as const;
        }

        const available =
          stock.totalUnits - stock.reservedUnits;

        if (available < quantity) {
          return {
            ok: false,
            reason: "insufficient_stock",
            available,
          } as const;
        }

        // Safe because row is locked
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
          data: {
            reservedUnits: {
              increment: quantity,
            },
          },
        });

        const expiresAt = new Date(
          Date.now() +
            RESERVATION_TTL_MINUTES * 60 * 1000
        );

        const reservation =
          await tx.reservation.create({
            data: {
              productId,
              warehouseId,
              quantity,
              status: "PENDING",
              expiresAt,
              idempotencyKey:
                idempotencyKey ?? undefined,
            },
            include: {
              product: true,
              warehouse: true,
            },
          });

        return {
          ok: true,
          reservation,
        } as const;
      });

      if (!result.ok) {
        const responseBody =
          result.reason === "insufficient_stock"
            ? {
                error: "Not enough stock available",
                available: result.available,
                requested: quantity,
              }
            : {
                error:
                  "Stock record not found for this product/warehouse combination",
              };

        const status =
          result.reason === "insufficient_stock"
            ? 409
            : 404;

        if (idempotencyKey) {
          await setIdempotencyResult(
            idempotencyKey,
            JSON.stringify({
              body: responseBody,
              status,
            })
          );
        }

        return NextResponse.json(responseBody, {
          status,
        });
      }

      const { reservation } = result;

      const responseBody = {
        id: reservation.id,
        productId: reservation.productId,
        productName: reservation.product.name,
        productSku: reservation.product.sku,
        warehouseId: reservation.warehouseId,
        warehouseName: reservation.warehouse.name,
        warehouseCode: reservation.warehouse.code,
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt:
          reservation.expiresAt.toISOString(),
        createdAt:
          reservation.createdAt.toISOString(),
      };

      if (idempotencyKey) {
        await setIdempotencyResult(
          idempotencyKey,
          JSON.stringify({
            body: responseBody,
            status: 201,
          })
        );
      }

      return NextResponse.json(responseBody, {
        status: 201,
      });
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  } catch (error) {
    console.error("[POST /api/reservations]", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reservations =
      await prisma.reservation.findMany({
        include: {
          product: true,
          warehouse: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      });

    return NextResponse.json({
      reservations,
    });
  } catch (error) {
    console.error(
      "[GET /api/reservations]",
      error
    );

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
