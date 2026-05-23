// components/CountdownTimer.tsx
"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  expiresAt: string;
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, onExpire }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const totalSeconds = 10 * 60; // 10 minutes

  useEffect(() => {
    const calculate = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) onExpire?.();
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const pct = (secondsLeft / totalSeconds) * 100;

  const isUrgent = secondsLeft < 120; // < 2 minutes
  const isCritical = secondsLeft < 30;
  const isExpired = secondsLeft === 0;

  const getBarColor = () => {
    if (isExpired) return "var(--text-muted)";
    if (isCritical) return "var(--danger)";
    if (isUrgent) return "var(--warning)";
    return "var(--accent)";
  };

  // Arc path for circular countdown
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={`flex flex-col items-center gap-4 p-6 rounded-xl border ${isUrgent && !isExpired ? "countdown-urgent" : ""}`}
      style={{
        background: isExpired ? "var(--bg)" : isCritical ? "var(--danger-dim)" : isUrgent ? "var(--warning-dim)" : "var(--bg-elevated)",
        borderColor: getBarColor(),
      }}
    >
      {/* Circular progress */}
      <div className="relative flex items-center justify-center">
        <svg width="80" height="80" viewBox="0 0 80 80">
          {/* Background ring */}
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
          />
          {/* Progress ring */}
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={getBarColor()}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 40 40)"
            style={{
              transition: "stroke-dashoffset 1s linear, stroke 0.3s ease",
              filter: isExpired ? "none" : `drop-shadow(0 0 4px ${getBarColor()})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-medium text-lg leading-none"
            style={{ color: getBarColor() }}
          >
            {isExpired
              ? "—"
              : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
          </span>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        {isExpired ? (
          <p className="font-display font-semibold text-sm" style={{ color: "var(--text-muted)" }}>
            Reservation Expired
          </p>
        ) : isCritical ? (
          <p className="font-display font-semibold text-sm" style={{ color: "var(--danger)" }}>
            ⚡ Expiring soon!
          </p>
        ) : isUrgent ? (
          <p className="font-display font-semibold text-sm" style={{ color: "var(--warning)" }}>
            Under 2 minutes left
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Hold expires at{" "}
            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
              {new Date(expiresAt).toLocaleTimeString()}
            </span>
          </p>
        )}
      </div>

      {/* Linear progress bar */}
      <div className="w-full">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: getBarColor(),
              transition: "width 1s linear",
              boxShadow: isExpired ? "none" : `0 0 8px ${getBarColor()}80`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
            0:00
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
            10:00
          </span>
        </div>
      </div>
    </div>
  );
}
