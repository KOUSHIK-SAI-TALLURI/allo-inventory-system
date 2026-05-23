// app/checkout/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CountdownTimer } from "@/components/CountdownTimer";

interface Reservation {
  id: string;
  productName: string;
  productSku: string;
  productDescription: string;
  productCategory: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseLocation: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
}

type ActionState = "idle" | "confirming" | "cancelling" | "done";

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${params.id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReservation(data);
      if (data.status !== "PENDING") setExpired(data.status === "RELEASED");
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const handleConfirm = async () => {
    setActionState("confirming");
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${params.id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `confirm-${params.id}`,
        },
      });
      const data = await res.json();
      if (res.status === 200) {
        await fetchReservation();
        setActionState("done");
      } else if (res.status === 410) {
        setActionError("410 · " + data.error);
        setExpired(true);
        setActionState("idle");
        fetchReservation();
      } else {
        setActionError(data.error ?? "Confirmation failed");
        setActionState("idle");
      }
    } catch {
      setActionError("Network error. Please retry.");
      setActionState("idle");
    }
  };

  const handleCancel = async () => {
    setActionState("cancelling");
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${params.id}/release`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await fetchReservation();
        setActionState("done");
      } else {
        setActionError(data.error ?? "Release failed");
        setActionState("idle");
      }
    } catch {
      setActionError("Network error. Please retry.");
      setActionState("idle");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div
            className="absolute inset-0 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--border-bright)", borderTopColor: "var(--accent)" }}
          />
        </div>
      </div>
    );
  }

  if (notFound || !reservation) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center">
          <p className="font-display font-bold text-xl" style={{ color: "var(--text-primary)" }}>
            Reservation not found
          </p>
          <p className="text-sm mt-2 mb-6" style={{ color: "var(--text-muted)" }}>
            ID: <span className="font-mono">{params.id}</span>
          </p>
          <button onClick={() => router.push("/")} className="btn-ghost px-5 py-2 rounded-lg text-sm">
            ← Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  const isTerminal = reservation.status !== "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";

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
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <span>←</span>
            <span>Inventory</span>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm"
              style={{ background: "var(--accent)", color: "#0a0b0d" }}
            >
              A
            </div>
            <span className="font-display font-bold text-sm" style={{ color: "var(--text-primary)" }}>
              Checkout
            </span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Status Banner */}
        {isConfirmed && (
          <div
            className="mb-6 rounded-xl p-5 border text-center fade-in-up"
            style={{ background: "var(--accent-dim)", borderColor: "rgba(0,212,170,0.3)" }}
          >
            <div className="text-3xl mb-2">✓</div>
            <h2 className="font-display font-bold text-xl" style={{ color: "var(--accent)" }}>
              Order Confirmed
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Payment processed · Units permanently allocated
            </p>
            {reservation.confirmedAt && (
              <p className="text-xs font-mono mt-2" style={{ color: "var(--text-muted)" }}>
                {new Date(reservation.confirmedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {isReleased && (
          <div
            className="mb-6 rounded-xl p-5 border text-center fade-in-up"
            style={{ background: "var(--danger-dim)", borderColor: "rgba(239,68,68,0.3)" }}
          >
            <div className="text-3xl mb-2">×</div>
            <h2 className="font-display font-bold text-xl" style={{ color: "var(--danger)" }}>
              Hold Released
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {expired ? "Reservation expired — units returned to stock" : "Cancelled — units returned to stock"}
            </p>
          </div>
        )}

        {/* Reservation Card */}
        <div
          className="rounded-xl border overflow-hidden fade-in-up fade-in-up-delay-1"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          {/* Product info */}
          <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded mb-2 inline-block"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    fontSize: "10px",
                  }}
                >
                  {reservation.productSku}
                </span>
                <h1 className="font-display font-bold text-xl" style={{ color: "var(--text-primary)" }}>
                  {reservation.productName}
                </h1>
                {reservation.productDescription && (
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                    {reservation.productDescription}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full font-mono font-medium shrink-0 ${
                  isConfirmed ? "status-confirmed" : isReleased ? "status-released" : "status-pending"
                }`}
              >
                {reservation.status}
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="p-6 grid grid-cols-2 gap-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Reservation ID
              </p>
              <p className="font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                …{reservation.id.slice(-8)}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Quantity
              </p>
              <p className="font-mono text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Fulfil from
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    fontSize: "10px",
                  }}
                >
                  {reservation.warehouseCode}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {reservation.warehouseName}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Location
              </p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {reservation.warehouseLocation}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Reserved at
              </p>
              <p className="font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                {new Date(reservation.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Countdown (only while pending) */}
          {!isTerminal && (
            <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                Payment window
              </p>
              <CountdownTimer
                expiresAt={reservation.expiresAt}
                onExpire={() => {
                  setExpired(true);
                  fetchReservation();
                }}
              />
            </div>
          )}

          {/* Error */}
          {actionError && (
            <div
              className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm font-mono"
              style={{
                background: "var(--danger-dim)",
                color: "var(--danger)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              {actionError}
            </div>
          )}

          {/* Actions */}
          <div className="p-6 flex flex-col gap-3">
            {!isTerminal && !expired ? (
              <>
                <button
                  onClick={handleConfirm}
                  disabled={actionState !== "idle"}
                  className="btn-primary w-full py-3 rounded-xl text-sm"
                >
                  {actionState === "confirming" ? "Processing…" : "Confirm Purchase"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionState !== "idle"}
                  className="btn-ghost w-full py-3 rounded-xl text-sm"
                >
                  {actionState === "cancelling" ? "Cancelling…" : "Cancel & Release Hold"}
                </button>
              </>
            ) : expired && !isTerminal ? (
              <div className="text-center">
                <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                  This reservation has expired. The hold will be released automatically.
                </p>
                <button onClick={() => router.push("/")} className="btn-ghost px-6 py-2.5 rounded-xl text-sm">
                  ← Back to Inventory
                </button>
              </div>
            ) : (
              <button onClick={() => router.push("/")} className="btn-ghost w-full py-3 rounded-xl text-sm">
                ← Back to Inventory
              </button>
            )}
          </div>
        </div>

        {/* Technical footnote */}
        <div className="mt-6 rounded-xl border p-4 fade-in-up fade-in-up-delay-2" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <p className="text-xs mb-2 font-display font-semibold" style={{ color: "var(--text-muted)" }}>
            How this works
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            This reservation holds{" "}
            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
              {reservation.quantity}
            </span>{" "}
            unit(s) for up to 10 minutes. A distributed Redis lock ensures concurrent checkout
            requests for the same SKU are serialised — exactly one wins, the rest get a 409.
            Expired reservations are cleaned up by a Vercel Cron job every minute, and lazily
            on every product list request.
          </p>
        </div>
      </main>
    </div>
  );
}
