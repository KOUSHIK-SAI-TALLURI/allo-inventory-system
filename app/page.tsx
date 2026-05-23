// app/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StockBar } from "@/components/StockBar";
import { ConcurrencyProbe } from "@/components/ConcurrencyProbe";

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  stock: WarehouseStock[];
  totalAvailable: number;
}

type ReserveState = "idle" | "picking" | "loading" | "error";

const CATEGORY_ICONS: Record<string, string> = {
  Electronics: "◈",
  Furniture: "⬡",
  Accessories: "◇",
  Storage: "▤",
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reserveState, setReserveState] = useState<Record<string, ReserveState>>({});
  const [selectedWarehouse, setSelectedWarehouse] = useState<Record<string, string>>({});
  const [reserveError, setReserveError] = useState<Record<string, string>>({});
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [probeProduct, setProbeProduct] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data.products);
    } catch {
      setError("Could not load inventory. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    // Poll every 15s for live updates
    const interval = setInterval(fetchProducts, 15000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  const handleReserve = async (product: Product) => {
    const pid = product.id;
    const wid = selectedWarehouse[pid];

    if (!wid) {
      setReserveState((s) => ({ ...s, [pid]: "picking" }));
      return;
    }

    setReserveState((s) => ({ ...s, [pid]: "loading" }));
    setReserveError((s) => ({ ...s, [pid]: "" }));

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `reserve-${pid}-${wid}-${Date.now()}`,
        },
        body: JSON.stringify({ productId: pid, warehouseId: wid, quantity: 1 }),
      });

      const data = await res.json();

      if (res.status === 201) {
        router.push(`/checkout/${data.id}`);
      } else if (res.status === 409) {
        setReserveError((s) => ({
          ...s,
          [pid]: `Not enough stock. Available: ${data.available ?? 0}`,
        }));
        setReserveState((s) => ({ ...s, [pid]: "error" }));
        fetchProducts();
      } else {
        setReserveError((s) => ({ ...s, [pid]: data.error ?? "Reservation failed" }));
        setReserveState((s) => ({ ...s, [pid]: "error" }));
      }
    } catch {
      setReserveError((s) => ({ ...s, [pid]: "Network error. Please retry." }));
      setReserveState((s) => ({ ...s, [pid]: "error" }));
    }
  };

const categories = Array.from(
  new Set(products.map((p) => p.category).filter(Boolean))
);
  const filtered = filterCategory ? products.filter((p) => p.category === filterCategory) : products;

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div
              className="absolute inset-0 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--border-bright)", borderTopColor: "var(--accent)" }}
            />
          </div>
          <span className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>
            Loading inventory…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div
          className="max-w-sm w-full rounded-xl p-6 border text-center"
          style={{ background: "var(--bg-surface)", borderColor: "var(--danger)" }}
        >
          <p className="font-display font-semibold" style={{ color: "var(--danger)" }}>
            Connection Error
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            {error}
          </p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchProducts(); }}
            className="btn-ghost mt-4 px-4 py-2 rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "rgba(10, 11, 13, 0.92)",
          backdropFilter: "blur(12px)",
          borderColor: "var(--border)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm"
              style={{ background: "var(--accent)", color: "#0a0b0d" }}
            >
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base" style={{ color: "var(--text-primary)" }}>
                  Allo
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", fontSize: "10px" }}
                >
                  INVENTORY
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                Warehouse Control
              </p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--accent)" }} />
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              LIVE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page title */}
        <div className="mb-8 fade-in-up">
          <h1 className="font-display font-bold text-3xl" style={{ color: "var(--text-primary)" }}>
            Product Inventory
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {products.length} products across {products[0]?.stock.length ?? 0} warehouses ·{" "}
            <span className="font-mono" style={{ color: "var(--accent)" }}>
              {products.reduce((s, p) => s + p.totalAvailable, 0)}
            </span>{" "}
            units available
          </p>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 mb-6 fade-in-up fade-in-up-delay-1">
            <button
              onClick={() => setFilterCategory(null)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={{
                background: filterCategory === null ? "var(--accent)" : "transparent",
                color: filterCategory === null ? "#0a0b0d" : "var(--text-secondary)",
                borderColor: filterCategory === null ? "var(--accent)" : "var(--border)",
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
              }}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                style={{
                  background: filterCategory === cat ? "var(--accent)" : "transparent",
                  color: filterCategory === cat ? "#0a0b0d" : "var(--text-secondary)",
                  borderColor: filterCategory === cat ? "var(--accent)" : "var(--border)",
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 600,
                }}
              >
                {CATEGORY_ICONS[cat] ?? "·"} {cat}
              </button>
            ))}
          </div>
        )}

        {/* Product grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product, idx) => {
            const state = reserveState[product.id] ?? "idle";
            const error = reserveError[product.id];
            const selectedWH = selectedWarehouse[product.id];
            const isOutOfStock = product.totalAvailable === 0;

            return (
              <div
                key={product.id}
                className="product-card rounded-xl border p-5 flex flex-col gap-4 fade-in-up"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                  animationDelay: `${idx * 0.05}s`,
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                {/* Product header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-mono"
                        style={{
                          background: "var(--bg-elevated)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                          fontSize: "10px",
                        }}
                      >
                        {product.sku}
                      </span>
                      {product.category && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {CATEGORY_ICONS[product.category] ?? ""} {product.category}
                        </span>
                      )}
                    </div>
                    {isOutOfStock ? (
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        OUT
                      </span>
                    ) : product.totalAvailable <= 3 ? (
                      <span className="text-xs font-mono px-2 py-0.5 rounded pulse-live" style={{ background: "var(--warning-dim)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.2)" }}>
                        {product.totalAvailable} LEFT
                      </span>
                    ) : null}
                  </div>
                  <h2 className="font-display font-semibold text-base leading-snug" style={{ color: "var(--text-primary)" }}>
                    {product.name}
                  </h2>
                  {product.description && (
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {product.description}
                    </p>
                  )}
                </div>

                {/* Stock levels */}
                <div className="flex flex-col gap-3 py-3 border-t border-b" style={{ borderColor: "var(--border)" }}>
                  {product.stock.map((s) => (
                    <StockBar
                      key={s.warehouseId}
                      total={s.totalUnits}
                      reserved={s.reservedUnits}
                      available={s.availableUnits}
                      warehouseCode={s.warehouseCode}
                      warehouseName={s.warehouseName}
                    />
                  ))}
                </div>

                {/* Warehouse picker */}
                {!isOutOfStock && state !== "loading" && (
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                      Fulfil from
                    </label>
                    <select
                      className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-bright)",
                        color: selectedWH ? "var(--text-primary)" : "var(--text-muted)",
                        outline: "none",
                      }}
                      value={selectedWH ?? ""}
                      onChange={(e) =>
                        setSelectedWarehouse((s) => ({ ...s, [product.id]: e.target.value }))
                      }
                    >
                      <option value="">Select warehouse…</option>
                      {product.stock
                        .filter((s) => s.availableUnits > 0)
                        .map((s) => (
                          <option key={s.warehouseId} value={s.warehouseId}>
                            [{s.warehouseCode}] {s.warehouseName} — {s.availableUnits} avail.
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Error */}
                {error && state === "error" && (
                  <div
                    className="rounded-lg px-3 py-2 text-xs font-mono"
                    style={{ background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    409 · {error}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={() => handleReserve(product)}
                  disabled={isOutOfStock || state === "loading" || (!selectedWH && state !== "picking")}
                  className={`btn-primary w-full py-2.5 rounded-lg text-sm ${isOutOfStock ? "opacity-30 cursor-not-allowed" : ""}`}
                >
                  {state === "loading"
                    ? "Reserving…"
                    : isOutOfStock
                    ? "Out of Stock"
                    : !selectedWH
                    ? "Select Warehouse First"
                    : "Reserve · Checkout"}
                </button>

                {/* Concurrency probe toggle */}
                {!isOutOfStock && selectedWH && (
                  <button
                    onClick={() => setProbeProduct(probeProduct === product.id ? null : product.id)}
                    className="text-xs text-center transition-colors"
                    style={{ color: probeProduct === product.id ? "var(--info)" : "var(--text-muted)" }}
                  >
                    {probeProduct === product.id ? "▲ Hide" : "▼ Show"} Concurrency Probe
                  </button>
                )}

                {probeProduct === product.id && selectedWH && (
                  <ConcurrencyProbe
                    productId={product.id}
                    warehouseId={selectedWH}
                    warehouseName={product.stock.find((s) => s.warehouseId === selectedWH)?.warehouseName ?? ""}
                    available={product.stock.find((s) => s.warehouseId === selectedWH)?.availableUnits ?? 0}
                    onReserved={fetchProducts}
                  />
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Allo Engineering · Take-Home Exercise
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Reservations expire after 10 min · Auto-cleanup every 60s
          </span>
        </div>
      </footer>
    </div>
  );
}
