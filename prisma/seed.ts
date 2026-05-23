// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Central", location: "Mumbai, MH", code: "MUM-01" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi North Hub", location: "Delhi, DL", code: "DEL-02" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore Tech Park", location: "Bangalore, KA", code: "BLR-03" },
    }),
  ]);

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Noise-Cancelling Headphones",
        sku: "WNC-HD-001",
        description: "Premium over-ear headphones with 30hr battery",
        category: "Electronics",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard TKL",
        sku: "MKB-TKL-002",
        description: "Tenkeyless mechanical keyboard, Cherry MX switches",
        category: "Electronics",
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Office Chair",
        sku: "ERG-CHR-003",
        description: "Lumbar support mesh chair, adjustable armrests",
        category: "Furniture",
      },
    }),
    prisma.product.create({
      data: {
        name: "Standing Desk 140cm",
        sku: "STD-DSK-004",
        description: "Electric height-adjustable desk",
        category: "Furniture",
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C Hub 7-in-1",
        sku: "USB-HUB-005",
        description: "HDMI 4K, 3x USB-A, SD card, PD 100W",
        category: "Accessories",
      },
    }),
    prisma.product.create({
      data: {
        name: "Portable SSD 1TB",
        sku: "SSD-PTB-006",
        description: "1050MB/s read speed, USB 3.2 Gen2",
        category: "Storage",
      },
    }),
  ]);

  // Stock levels - intentionally varied, some scarce to demonstrate the reservation system
  const stockData = [
    // Headphones
    { product: 0, warehouse: 0, total: 12, reserved: 0 },
    { product: 0, warehouse: 1, total: 3, reserved: 0 },  // scarce
    { product: 0, warehouse: 2, total: 8, reserved: 0 },
    // Keyboard
    { product: 1, warehouse: 0, total: 20, reserved: 0 },
    { product: 1, warehouse: 1, total: 1, reserved: 0 },  // very scarce
    { product: 1, warehouse: 2, total: 15, reserved: 0 },
    // Chair
    { product: 2, warehouse: 0, total: 6, reserved: 0 },
    { product: 2, warehouse: 1, total: 4, reserved: 0 },
    { product: 2, warehouse: 2, total: 2, reserved: 0 },  // scarce
    // Desk
    { product: 3, warehouse: 0, total: 5, reserved: 0 },
    { product: 3, warehouse: 2, total: 3, reserved: 0 },
    // USB Hub
    { product: 4, warehouse: 0, total: 50, reserved: 0 },
    { product: 4, warehouse: 1, total: 30, reserved: 0 },
    { product: 4, warehouse: 2, total: 25, reserved: 0 },
    // SSD
    { product: 5, warehouse: 0, total: 18, reserved: 0 },
    { product: 5, warehouse: 1, total: 10, reserved: 0 },
  ];

  for (const s of stockData) {
    await prisma.stockLevel.create({
      data: {
        productId: products[s.product].id,
        warehouseId: warehouses[s.warehouse].id,
        totalUnits: s.total,
        reservedUnits: s.reserved,
      },
    });
  }

  console.log(`✅ Created ${warehouses.length} warehouses`);
  console.log(`✅ Created ${products.length} products`);
  console.log(`✅ Created ${stockData.length} stock levels`);
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
