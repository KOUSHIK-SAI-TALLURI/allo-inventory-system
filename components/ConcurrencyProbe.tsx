// components/ConcurrencyProbe.tsx
"use client";

import { useState } from "react";

interface ProbeResult {
  attempt: number;
  status: number;
  outcome: "success" | "conflict" | "error";
  message: string;
  latencyMs: number;
}

interface ConcurrencyProbeProps {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  available: number;
  onReserved?: () => void;
}

export function ConcurrencyProbe({
  productId,
  warehouseId,
  warehouseName,
  available,
  onReserved,
}: ConcurrencyProbeProps) {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [running, setRunning] = useState(false);

  const runProbe = async () => {
    if (available === 0) return;
    setRunning(true);
    setResults([]);

    // Fire N simultaneous requests where N > available (if scarce) or = 2
    const concurrency = Math.min(available + 1, 4);

    const start = performance.now();

    const promises = Array.from({ length: concurrency }, async (_, i) => {
      const t0 = performance.now();
      try {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
        });
        const data = await res.json();
        const latency = Math.round(performance.now() - t0);

        if (res.status === 201) {
          return {
            attempt: i + 1,
            status: res.status,
            outcome: "success" as const,
            message: `Reserved → ID ${data.id?.slice(-6)}`,
            latencyMs: latency,
          };
        } else if (res.status === 409) {
          return {
            attempt: i + 1,
            status: res.status,
            outcome: "conflict" as const,
            message: data.error ?? "409 Conflict",
            latencyMs: latency,
          };
        } else {
          return {
            attempt: i + 1,
            status: res.status,
            outcome: "error" as const,
            message: data.error ?? "Unexpected error",
            latencyMs: latency,
          };
        }
      } catch {
        return {
          attempt: i + 1,
          status: 0,
          outcome: "error" as const,
          message: "Network error",
          latencyMs: Math.round(performance.now() - t0),
        };
      }
    });

    const settled = await Promise.all(promises);
    settled.sort((a, b) => a.latencyMs - b.latencyMs);
    setResults(settled);
    setRunning(false);

    const succeeded = settled.filter((r) => r.outcome === "success").length;
    if (succeeded > 0) onReserved?.();
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: "var(--bg)",
        borderColor: "var(--border)",
        borderStyle: "dashed",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--info-dim)", color: "var(--info)", border: "1px solid rgba(96,165,250,0.2)", fontSize: "10px" }}>
              DEV TOOL
            </span>
            <h4 className="font-display font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              Concurrency Probe
            </h4>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Fires {Math.min(available + 1, 4)} simultaneous reserve requests to demonstrate race-condition protection.
          </p>
        </div>
        <button
          onClick={runProbe}
          disabled={running || available === 0}
          className="btn-ghost text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0"
          style={{ fontSize: "12px" }}
        >
          {running ? "Running…" : available === 0 ? "No stock" : "▶ Run"}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1.5 mt-3">
          {results.map((r) => (
            <div
              key={r.attempt}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{
                background:
                  r.outcome === "success"
                    ? "var(--accent-dim)"
                    : r.outcome === "conflict"
                    ? "var(--warning-dim)"
                    : "var(--danger-dim)",
                border: `1px solid ${
                  r.outcome === "success"
                    ? "rgba(0,212,170,0.2)"
                    : r.outcome === "conflict"
                    ? "rgba(245,158,11,0.2)"
                    : "rgba(239,68,68,0.2)"
                }`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  #{r.attempt}
                </span>
                <span
                  className="font-mono text-xs font-medium"
                  style={{
                    color:
                      r.outcome === "success"
                        ? "var(--accent)"
                        : r.outcome === "conflict"
                        ? "var(--warning)"
                        : "var(--danger)",
                  }}
                >
                  {r.status === 201 ? "201 OK" : `${r.status}`}
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {r.message}
                </span>
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                {r.latencyMs}ms
              </span>
            </div>
          ))}
          <p className="text-xs mt-2 text-center" style={{ color: "var(--text-muted)" }}>
            {results.filter((r) => r.outcome === "success").length} succeeded ·{" "}
            {results.filter((r) => r.outcome === "conflict").length} blocked (409)
          </p>
        </div>
      )}
    </div>
  );
}
