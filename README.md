# Allo Inventory System

Concurrency-safe inventory reservation system built for the Allo Engineering Take-Home Exercise.

## Live Demo
https://allo-inventory-system-silk.vercel.app/

## GitHub Repository

https://github.com/KOUSHIK-SAI-TALLURI/allo-inventory-system

---

# Overview

This project implements a temporary inventory reservation system for multi-warehouse commerce workflows.

The core problem addressed is preventing overselling during checkout flows where payment confirmation can take several minutes (UPI, 3DS, wallet redirects, etc.).

Instead of decrementing inventory only after payment success, the system creates a short-lived reservation that temporarily holds stock units during checkout.

If payment succeeds:
- reservation is confirmed
- stock is permanently consumed

If payment fails or expires:
- reservation is released
- units become available again

The implementation focuses heavily on:
- correctness under concurrency
- race-condition prevention
- transactional consistency
- production-style backend architecture

---

# Tech Stack

## Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

## Backend
- Next.js Route Handlers
- Prisma ORM
- Neon PostgreSQL
- Upstash Redis

## Validation & Utilities
- Zod
- Redis distributed locking
- Prisma transactions

---

# Features

## Inventory & Warehouses
- Multi-warehouse inventory support
- Per-warehouse stock visibility
- Available vs reserved stock tracking

## Reservation System
- Create reservations
- Confirm reservations
- Release reservations
- Automatic reservation expiry

## Concurrency Safety
- Prevents overselling under concurrent requests
- Row-level transaction consistency
- Redis distributed locking

## UX
- Live reservation countdown
- Reservation status tracking
- Real-time inventory refresh
- Error visibility for:
  - 409 insufficient stock
  - 410 expired reservation

## Bonus Features
- Idempotency-Key support
- Concurrency testing probe
- Reservation state indicators

---

# Data Model

## Product
Represents a sellable inventory item.

## Warehouse
Represents a physical fulfillment location.

## StockLevel
Tracks:
- totalUnits
- reservedUnits
- availableUnits

per product per warehouse.

## Reservation
Tracks:
- PENDING
- CONFIRMED
- RELEASED

along with:
- expiry timestamps
- release timestamps
- confirmation timestamps

---

# API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Create reservation |
| POST | `/api/reservations/:id/confirm` | Confirm reservation |
| POST | `/api/reservations/:id/release` | Release reservation |

---

# Concurrency Strategy

Concurrency correctness was treated as the primary focus of the assignment.

The reservation flow uses:

## 1. Redis Distributed Locking

Before mutating inventory, a Redis lock is acquired per:
- product
- warehouse

This prevents simultaneous reservation mutations across distributed instances.

## 2. Prisma Transactions

Reservation creation and stock updates happen atomically inside database transactions.

## 3. Atomic Reserved Unit Updates

Stock updates use increment/decrement operations rather than overwriting values.

This guarantees that:
- two concurrent requests for the final unit cannot both succeed
- exactly one request succeeds
- remaining requests receive `409`

---

# Reservation Expiry Strategy

Reservations expire after 10 minutes.

Expired reservations are automatically released using:
- lazy cleanup on reads

Whenever inventory is fetched:
- expired pending reservations are detected
- reserved units are decremented
- reservation state changes to RELEASED

A cron-based approach was initially explored but removed for compatibility with Vercel Hobby deployment limits.

---

# Idempotency

The reservation endpoint supports:
- `Idempotency-Key`

Duplicate retries with the same key return the original response without repeating the side effect.

This helps protect against:
- client retries
- unstable network conditions
- accidental double submissions

---

# Frontend Flow

## Product Page

Displays:
- products
- warehouse stock
- reserved quantities
- concurrency probe

Users can:
- choose warehouse
- reserve inventory
- proceed to checkout

## Checkout Page

Displays:
- reservation details
- countdown timer
- confirm purchase button
- cancel reservation button

UI updates reflect state transitions immediately.

---

# Running Locally

## 1. Clone Repository

```bash
git clone https://github.com/KOUSHIK-SAI-TALLURI/allo-inventory-system.git
cd allo-inventory-system
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create `.env`

```env
DATABASE_URL="your_neon_postgres_url"

REDIS_URL="your_upstash_redis_url"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 4. Generate Prisma Client

```bash
npx prisma generate
```

## 5. Push Schema

```bash
npx prisma db push
```

## 6. Seed Database

```bash
npm run db:seed
```

## 7. Run Development Server

```bash
npm run dev
```

---

# Production Deployment

Deployment stack:
- Vercel
- Neon PostgreSQL
- Upstash Redis

Environment variables configured in Vercel:
- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_APP_URL`

---

# Trade-offs & Improvements

## Current Trade-offs
- Expiry cleanup currently uses lazy reads rather than dedicated workers
- No authentication layer
- No payment gateway integration
- Reservation polling interval is simplistic

## Future Improvements
- Dedicated background worker for expiry cleanup
- WebSocket-based real-time inventory updates
- Reservation analytics dashboard
- Event-driven inventory architecture
- Distributed queue processing

---

# What I Focused On

The assignment specifically emphasized:
- correctness under concurrency
- race-condition prevention
- clear architecture

Most effort was intentionally spent on:
- reservation consistency
- transaction safety
- distributed locking
- backend correctness

rather than extensive UI complexity.

---

# Notes

The system was tested using:
- concurrent reservation attempts
- reservation expiry scenarios
- release flows
- confirmation flows

The application is fully deployed and functional end-to-end.