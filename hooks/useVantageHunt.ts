import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getCurrentPosition } from '@/lib/location';
import {
  type HuntMovementMode,
  type VantageArrival,
  type VantageHuntSession,
  clearVantageHuntSession,
  loadVantageHuntSession,
  resolveVantageArrival,
  saveVantageHuntSession,
} from '@/lib/vantageHunt';
import { getTodayLocalDateString } from '@/lib/streakStats';
import posthog from '@/lib/posthog';

export function useVantageHunt() {
  const [session, setSession] = useState<VantageHuntSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [arrival, setArrival] = useState<VantageArrival | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);

  const refresh = useCallback(async () => {
    const stored = await loadVantageHuntSession();
    setSession(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  const beginHunt = useCallback(async (movementMode: HuntMovementMode) => {
    setLocationBusy(true);
    try {
      const coords = await getCurrentPosition();
      if (!coords) return { ok: false as const, reason: 'location' as const };

      const next: VantageHuntSession = {
        dateYmd: getTodayLocalDateString(),
        phase: 'transit',
        movementMode,
        huntStartCoordinates: coords,
        huntStartTimestamp: new Date().toISOString(),
        predawnImageUri: null,
      };
      await saveVantageHuntSession(next);
      setSession(next);
      setArrival(null);
      try {
        if (posthog) posthog.capture('vantage_hunt_started', { movement_mode: movementMode });
      } catch {
        // ignore
      }
      return { ok: true as const };
    } finally {
      setLocationBusy(false);
    }
  }, []);

  const setPredawnImage = useCallback(
    async (uri: string | null) => {
      if (!session) return;
      const next = {
        ...session,
        predawnImageUri: uri,
        predawnImageCapturedAt: uri ? new Date().toISOString() : null,
      };
      await saveVantageHuntSession(next);
      setSession(next);
      if (uri) {
        try {
          if (posthog) posthog.capture('vantage_hunt_predawn_added');
        } catch {
          // ignore
        }
      }
    },
    [session]
  );

  const markArrived = useCallback(async () => {
    if (!session) return { ok: false as const, reason: 'no_session' as const };
    setLocationBusy(true);
    try {
      const coords = await getCurrentPosition();
      if (!coords) return { ok: false as const, reason: 'location' as const };

      const resolved = await resolveVantageArrival(session.huntStartCoordinates, coords);
      setArrival(resolved);
      try {
        if (posthog) {
          posthog.capture('vantage_hunt_arrived', {
            displacement_meters: resolved.displacementMeters,
            movement_mode: session.movementMode,
          });
        }
      } catch {
        // ignore
      }
      return { ok: true as const, arrival: resolved };
    } finally {
      setLocationBusy(false);
    }
  }, [session]);

  const endHunt = useCallback(async () => {
    await clearVantageHuntSession();
    setSession(null);
    setArrival(null);
  }, []);

  return {
    session,
    loading,
    arrival,
    locationBusy,
    beginHunt,
    setPredawnImage,
    markArrived,
    endHunt,
    refresh,
  };
}
