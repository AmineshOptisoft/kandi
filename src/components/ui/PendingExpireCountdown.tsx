"use client";

import { useEffect, useState } from "react";

function parseEndMs(iso: string): number {
  const t = new Date(iso.trim()).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Live countdown until `expiresAtIso`; shows "Expired" at 0. */
export default function PendingExpireCountdown({
  expiresAtIso,
  assignedAtIso,
  delayMinutes,
}: {
  expiresAtIso: string;
  assignedAtIso?: string;
  delayMinutes?: number;
}) {
  const [remainSec, setRemainSec] = useState(0);

  useEffect(() => {
    const end = parseEndMs(expiresAtIso);
    if (Number.isNaN(end)) {
      setRemainSec(0);
      return;
    }
    const tick = () => {
      const now = Date.now();
      if (assignedAtIso && delayMinutes && delayMinutes > 0) {
        const assignedTime = new Date(assignedAtIso.trim()).getTime();
        if (Number.isFinite(assignedTime)) {
          const cooldownEnd = assignedTime + delayMinutes * 60_000;
          if (now < cooldownEnd) {
            const activeWindowMs = Math.max(0, end - cooldownEnd);
            setRemainSec(Math.ceil(activeWindowMs / 1000));
            return;
          }
        }
      }
      setRemainSec(Math.max(0, Math.ceil((end - now) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAtIso, assignedAtIso, delayMinutes]);

  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  const label = remainSec <= 0 ? "Expired" : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <span
      className={`text-[10px] font-semibold tabular-nums whitespace-nowrap ${
        remainSec <= 0 ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"
      }`}
      title="Time left before this request auto-expires"
    >
      {remainSec <= 0 ? label : `Expires ${label}`}
    </span>
  );
}
