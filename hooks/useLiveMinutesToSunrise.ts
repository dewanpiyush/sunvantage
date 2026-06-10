import { useEffect, useState } from 'react';

/** Tick minutes-to-sunrise down every minute between context refreshes. */
export function useLiveMinutesToSunrise(minutesToSunrise: number | null): number | null {
  const [live, setLive] = useState(minutesToSunrise);

  useEffect(() => {
    setLive(minutesToSunrise);
  }, [minutesToSunrise]);

  useEffect(() => {
    const id = setInterval(() => {
      setLive((current) => (current != null ? current - 1 : current));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return live;
}
