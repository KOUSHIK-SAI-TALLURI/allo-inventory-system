// components/StockBar.tsx
"use client";

interface StockBarProps {
  total: number;
  reserved: number;
  available: number;
  warehouseCode: string;
  warehouseName: string;
}

export function StockBar({ total, reserved, available, warehouseCode, warehouseName }: StockBarProps) {
  const availablePct = total > 0 ? (available / total) * 100 : 0;
  const reservedPct = total > 0 ? (reserved / total) * 100 : 0;

  const getColor = () => {
    if (availablePct > 50) return "var(--accent)";
    if (availablePct > 20) return "var(--warning)";
    return "var(--danger)";
  };

  const urgency = availablePct <= 20 ? "low" : availablePct <= 50 ? "mid" : "high";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
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
            {warehouseCode}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {warehouseName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {urgency === "low" && available > 0 && (
            <span className="text-xs font-mono" style={{ color: "var(--danger)" }}>
              LOW STOCK
            </span>
          )}
          {available === 0 && (
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              OUT OF STOCK
            </span>
          )}
          <span
            className="font-mono text-xs font-medium"
            style={{ color: available === 0 ? "var(--text-muted)" : "var(--text-primary)" }}
          >
            {available}
            <span style={{ color: "var(--text-muted)" }}>/{total}</span>
          </span>
        </div>
      </div>

      {/* Bar */}
      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        {/* Reserved portion */}
        {reservedPct > 0 && (
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
            style={{
              width: `${reservedPct + availablePct}%`,
              background: "var(--border-bright)",
            }}
          />
        )}
        {/* Available portion */}
        <div
          className="absolute top-0 left-0 h-full rounded-full stock-bar"
          style={{
            "--fill-width": `${availablePct}%`,
            width: `${availablePct}%`,
            background: getColor(),
            boxShadow: availablePct > 0 ? `0 0 6px ${getColor()}60` : "none",
          } as React.CSSProperties}
        />
      </div>

      {/* Reserved indicator */}
      {reserved > 0 && (
        <div className="flex items-center gap-1">
          <div
            className="w-1.5 h-1.5 rounded-full pulse-live"
            style={{ background: "var(--warning)" }}
          />
          <span className="text-xs font-mono" style={{ color: "var(--warning)", fontSize: "10px" }}>
            {reserved} reserved
          </span>
        </div>
      )}
    </div>
  );
}
