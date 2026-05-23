// lib/schemas.ts
import { z } from "zod";

export const ReserveSchema = z.object({
  productId: z.string().min(1, "Product ID required"),
  warehouseId: z.string().min(1, "Warehouse ID required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100),
});

export const ConfirmReleaseSchema = z.object({
  id: z.string().min(1),
});

export type ReserveInput = z.infer<typeof ReserveSchema>;

export const RESERVATION_TTL_MINUTES = 10;
