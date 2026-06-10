import { useEffect, useState } from 'react';

/** Recompute countdown label once per minute (no seconds ticker). */
export function useVantageHuntCountdown(minutesToSunrise: number | null) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return { tick };
}
