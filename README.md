# Allo Inventory — Reservation System

A full-stack inventory reservation system built with Next.js 14, Prisma, Supabase, and Redis (Upstash).

**Live demo:** `[your-deployment-url]`

---

## Local Setup

### Prerequisites
- Node.js 18+
- A hosted Postgres instance (Supabase free tier recommended)
- A Redis instance (Upstash free tier recommended)

### 1. Clone & install
```bash
git clone https://github.com/your-username/allo-inventory
cd allo-inventory
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Fill in `.env`:
```
DATABASE_URL=postgresql://...    # from Supabase/Neon/Railway
REDIS_URL=redis://...            # from Upstash
CRON_SECRET=<openssl rand -hex 32>
```

### 3. Run migrations and seed
```bash
npm run db:push      # push schema to Postgres
npm run db:seed      # seed 3 warehouses, 6 products, stock levels
```

### 4. Start dev server
```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Architecture

### Data model

```
Product ──< StockLevel >── Warehouse
   │                            │
   └──────── Reservation ───────┘
```

`StockLevel` tracks two numbers per (product, warehouse) pair:
- `totalUnits` — physical units in the warehouse
- `reservedUnits` — units currently held by PENDING reservations

`availableUnits = totalUnits - reservedUnits` is computed at query time, not stored, to avoid a third field that could drift.

When a reservation is **confirmed**, both `totalUnits` and `reservedUnits` are decremented together (the units are sold and leave the warehouse). When it is **released**, only `reservedUnits` is decremented (units return to available stock).

---

### Concurrency strategy

The race condition the brief describes is classic: two concurrent requests both read "1 unit available", both pass the check, and both write a reservation. One of them is lying.

I protect against this with two layers:

**Layer 1 — Redis distributed lock**

Before touching the database, we acquire a per-(product, warehouse) Redis lock using `SET NX PX`. Only one request can hold the lock at a time. This serialises concurrent checkout requests for the same SKU. The lock is held for at most 8 seconds and is released in a `finally` block using a Lua eval script that checks the token before deleting (avoiding accidental lock release by a different caller).

**Layer 2 — `SELECT ... FOR UPDATE` inside a DB transaction**

The read + write pair executes inside `prisma.$transaction` with an explicit `FOR UPDATE` on the `StockLevel` row:

```sql
SELECT id, total_units, reserved_units
FROM "StockLevel"
WHERE product_id = $1 AND warehouse_id = $2
FOR UPDATE
```

`FOR UPDATE` acquires a row-level exclusive lock at the database level. Any other transaction attempting to read or write the same row blocks until the first transaction commits or rolls back. This is the hard correctness guarantee — even if Redis is unavailable, two concurrent requests cannot both pass the availability check for the same row.

The combination means: Redis prevents the race in the happy path (fast, no DB row contention), and `FOR UPDATE` makes the logic correct even if Redis is down (degraded throughput but no double-reservation).

```
Request A ──► acquire Redis lock ──► FOR UPDATE row ──► check (1) ──► reserve ──► commit ──► release lock
Request B ──► acquire Redis lock ─── (waits for lock)  ──────────────────────────────────► FOR UPDATE row ──► check (0) ──► 409
```

---

### Expiry mechanism (production)

Reservations that aren't confirmed before `expiresAt` are released by two complementary mechanisms:

**1. Vercel Cron (primary)**  
`vercel.json` schedules `GET /api/cron/expire-reservations` every minute. It runs `releaseExpiredReservations()` which finds all `PENDING` reservations with `expiresAt < now`, updates them to `RELEASED`, and decrements `reservedUnits` on the corresponding stock rows — atomically, in a single transaction.

The cron endpoint is protected by a `CRON_SECRET` bearer token so it can't be triggered by external callers.

**2. Lazy cleanup (defence-in-depth)**  
Every call to `GET /api/products` also runs `releaseExpiredReservations()`. This means even if the cron misses a cycle (cold start, rate limit), the product listing will always reflect accurate available stock the next time it's loaded.

The two mechanisms are idempotent — running cleanup twice on the same expired set is safe because the `WHERE status = PENDING` filter means already-released rows are skipped.

---

## ADRs (Architecture Decision Records)

### ADR-001: Redis lock + `SELECT FOR UPDATE`, not one or the other

**Decision:** Use both a Redis distributed lock and a `SELECT ... FOR UPDATE` inside the DB transaction.

**Context:** `SELECT FOR UPDATE` alone is correct but holds a DB connection open for the lock duration, creating connection pool pressure under high concurrency. A Redis lock alone is faster but leaves a correctness gap if Redis is unavailable.

**Chosen:** Redis lock (fast path, O(1), no DB row contention) + `SELECT FOR UPDATE` (correctness guarantee regardless of Redis availability). If Redis is down, requests serialise at the DB row lock instead — slower but still correct. Belt and braces, with explicit reasoning for each layer.

---

### ADR-002: `reservedUnits` as a counter, not derived from reservation rows

**Decision:** Store `reservedUnits` as a denormalised counter on `StockLevel`, not computed via `SUM(quantity) WHERE status = PENDING`.

**Context:** Joining and summing reservation rows on every stock availability check is O(n) per product/warehouse pair and adds a join to the hot read path.

**Chosen:** Maintain `reservedUnits` as an integer column, incremented on reserve and decremented on release/confirm. The invariant is maintained inside transactions so it can't drift. The trade-off is that a migration bug or code error could cause it to drift — acceptable given the test coverage and transaction safety.

---

### ADR-003: Lazy expiry + cron, not a background worker process

**Decision:** No persistent background worker (Bull queue, BullMQ, etc.).

**Context:** Vercel's serverless model doesn't support long-running processes. A queue worker would require a separate worker dyno or service.

**Chosen:** Vercel Cron (1-minute granularity) + lazy cleanup on reads. The maximum staleness is 1 minute, which is acceptable for a 10-minute reservation window. Described honestly in this README.

---

### ADR-004: Idempotency via Redis, not a DB table

**Decision:** Store idempotency results in Redis with a 24-hour TTL, not a dedicated `idempotency_keys` Postgres table.

**Context:** A DB table would survive Redis restarts, but adds a join and a migration. For a 24-hour window, Redis TTL is clean and sufficient.

**Chosen:** Redis. If Redis is unavailable, the idempotency check fails open (the request proceeds without deduplication), which is the safe failure mode — better than failing closed and blocking legitimate retries.

---

## Trade-offs and things I'd do differently

- **No payment gateway integration.** The confirm endpoint simulates successful payment. In production this would be a webhook from Stripe/Razorpay that calls confirm, not a direct client call.

- **No auth.** Reservations are not scoped to a user session. Adding Clerk or NextAuth would scope reservations to users and allow "my orders" views.

- **No optimistic locking on StockLevel.** I could add a `version` integer and do optimistic concurrency control instead of Redis locking. Redis distributed locks are operationally simpler here.

- **Cron granularity is 1 minute.** Vercel Cron minimum is 1 minute. If sub-minute cleanup were needed, I'd use Upstash QStash with a scheduled message pushed at reservation creation time.

- **No rate limiting on the reserve endpoint.** A production system would rate-limit by IP/user to prevent reservation farming.

- **Seed data.** The seed includes some intentionally scarce warehouses (1–2 units) to make the concurrency behaviour observable during the demo.
