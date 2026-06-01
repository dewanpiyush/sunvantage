import { useCallback, useState } from 'react';
import { isBeforeSunriseLoggingOpens } from '@/lib/sunriseLoggingWindow';

/**
 * Opens the sunrise log modal when within the logging window; otherwise shows the unfolding pause.
 */
export function useSunriseLogOpen(minutesToSunrise: number | null | undefined) {
  const [showLogCard, setShowLogCard] = useState(false);
  const [showUnfoldingPause, setShowUnfoldingPause] = useState(false);

  const requestOpenLog = useCallback(() => {
    if (isBeforeSunriseLoggingOpens(minutesToSunrise)) {
      setShowUnfoldingPause(true);
      return;
    }
    setShowLogCard(true);
  }, [minutesToSunrise]);

  const closeLog = useCallback(() => setShowLogCard(false), []);
  const dismissUnfoldingPause = useCallback(() => setShowUnfoldingPause(false), []);

  const onLogBlockedEarly = useCallback(() => {
    setShowLogCard(false);
    setShowUnfoldingPause(true);
  }, []);

  return {
    showLogCard,
    showUnfoldingPause,
    requestOpenLog,
    closeLog,
    dismissUnfoldingPause,
    onLogBlockedEarly,
    setShowLogCard,
  };
}
