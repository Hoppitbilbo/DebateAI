import { useEffect, useState } from "react";

/**
 * Seconds left until `expiresAt`, ticking every second. `serverNow`
 * corrects the clock of school computers, which are often wrong.
 */
export const useCountdown = (expiresAt: string | undefined, serverNow?: string) => {
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (serverNow) setSkew(Date.parse(serverNow) - Date.now());
  }, [serverNow]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((Date.parse(expiresAt) - (now + skew)) / 1000));
};

/** 5400 → "1:30:00", 300 → "5:00". */
export const formatCountdown = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
