/**
 * Vantage Hunt — dawn-only ritual: choose where to meet the sunrise.
 * Not fitness tracking. Foreground GPS snapshots only.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import supabase from '@/supabase';
import SunVantageHeader from '@/components/SunVantageHeader';
import SunriseLogCard, { type SunriseLogSaveResult } from '@/components/SunriseLogCard';
import MorningUnfoldingPause from '@/components/MorningUnfoldingPause';
import { useMorningContext } from '@/hooks/useMorningContext';
import { useActiveSunriseCity } from '@/hooks/useActiveSunriseCity';
import { useSunriseLogOpen } from '@/hooks/useSunriseLogOpen';
import { useVantageHunt } from '@/hooks/useVantageHunt';
import { useVantageHuntCountdown } from '@/hooks/useVantageHuntCountdown';
import { useDawn } from '@/hooks/use-dawn';
import { useAppTheme } from '@/context/AppThemeContext';
import ScreenLayout from '@/components/ScreenLayout';
import RitualTabBarOverlay from '@/components/RitualTabBarOverlay';
import VantageHuntTransit from '@/components/VantageHuntTransit';
import VantageHuntArrivalOverlay from '@/components/VantageHuntArrivalOverlay';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { hasLoggedToday } from '@/lib/hasLoggedToday';
import { formatSunriseTime } from '@/lib/formatSunriseTime';
import { getCurrentPosition } from '@/lib/location';
import { useLiveMinutesToSunrise } from '@/hooks/useLiveMinutesToSunrise';
import {
  type HuntMovementMode,
  formatHuntCountdown,
  getVantageHuntIntentionCopy,
  isInVantageHuntWindow,
  isVantageHuntRetrospective,
  resolveRetrospectiveVantage,
  shouldShowHuntCountdown,
  type VantageArrival,
} from '@/lib/vantageHunt';
import { ROUTES } from '@/lib/routes';
import { stashSunriseLogHandoff } from '@/lib/sunriseLogHandoff';

const ARRIVAL_TRANSITION_MS = 900;
const LOCATION_TIMEOUT_MS = 5_000;
const GEOCODE_TIMEOUT_MS = 5_000;

async function getCurrentPositionWithTimeout(): Promise<ReturnType<typeof getCurrentPosition>> {
  return Promise.race([
    getCurrentPosition(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
  ]);
}

const MOVEMENT_OPTIONS: { mode: HuntMovementMode; label: string; icon: string }[] = [
  { mode: 'walk', label: 'Walk', icon: '🚶' },
  { mode: 'cycle', label: 'Cycle', icon: '🚲' },
  { mode: 'vehicle', label: 'Vehicle', icon: '🚗' },
];

export default function VantageHuntScreen() {
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn, isMorningLight), [Dawn, isMorningLight]);
  const router = useRouter();

  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ created_at: string }[]>([]);
  const [logsReady, setLogsReady] = useState(false);
  const [selectedMode, setSelectedMode] = useState<HuntMovementMode>('walk');
  const [huntArrival, setHuntArrival] = useState<VantageArrival | null>(null);
  const [arrivalFinding, setArrivalFinding] = useState(false);
  const retrospectiveBootstrappedRef = useRef(false);

  const {
    session,
    loading: huntLoading,
    locationBusy,
    beginHunt,
    setPredawnImage,
    markArrived,
    endHunt,
  } = useVantageHunt();

  const { minutesToSunrise: habitualMinutes } = useMorningContext(profileCity);
  const loggedToday = hasLoggedToday(logs);

  const { sunriseCity } = useActiveSunriseCity(profileCity, {
    minutesToSunrise: habitualMinutes,
  });

  const { sunriseToday, minutesToSunrise, refresh: refreshMorning } = useMorningContext(sunriseCity);
  useVantageHuntCountdown(minutesToSunrise);
  const liveMinutesToSunrise = useLiveMinutesToSunrise(minutesToSunrise);

  useEffect(() => {
    const id = setInterval(() => {
      void refreshMorning();
    }, 60_000);
    return () => clearInterval(id);
  }, [refreshMorning]);

  const inHuntWindow = isInVantageHuntWindow(minutesToSunrise);
  const isRetrospective = isVantageHuntRetrospective(minutesToSunrise);
  const intentionCopy = getVantageHuntIntentionCopy(minutesToSunrise);
  const showCountdown = shouldShowHuntCountdown(minutesToSunrise);
  const countdownLabel = formatHuntCountdown(minutesToSunrise);
  const sunriseLabel = formatSunriseTime(sunriseToday);
  const showTabBar = !loggedToday;

  const {
    showLogCard,
    showUnfoldingPause,
    requestOpenLog,
    closeLog,
    dismissUnfoldingPause,
    onLogBlockedEarly,
    setShowLogCard,
  } = useSunriseLogOpen(minutesToSunrise);

  const loadProfile = useCallback(async () => {
    const {
      data: { session: auth },
    } = await supabase.auth.getSession();
    if (!auth?.user?.id) {
      setProfileCity(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('city')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    setProfileCity(data?.city?.trim() || null);
  }, []);

  const loadLogs = useCallback(async () => {
    const {
      data: { session: auth },
    } = await supabase.auth.getSession();
    if (!auth?.user?.id) {
      setLogs([]);
      setLogsReady(true);
      return;
    }
    const { data } = await supabase
      .from('sunrise_logs')
      .select('created_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });
    setLogs((data ?? []) as { created_at: string }[]);
    setLogsReady(true);
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadLogs();
  }, [loadProfile, loadLogs]);

  useFocusEffect(
    useCallback(() => {
      void loadLogs();
      void refreshMorning();
    }, [loadLogs, refreshMorning])
  );

  const isReturningForHunt = logs.length > 1;
  const guardsPending = huntLoading || !logsReady;

  useEffect(() => {
    if (guardsPending) return;
    if (!isReturningForHunt) {
      router.replace(ROUTES.today);
      return;
    }
    if (loggedToday) {
      router.replace(ROUTES.witness);
      return;
    }
    if (minutesToSunrise != null && !inHuntWindow) {
      router.replace(ROUTES.today);
    }
  }, [guardsPending, isReturningForHunt, loggedToday, minutesToSunrise, inHuntWindow, router]);

  const handleBeginHunt = async () => {
    const result = await beginHunt(selectedMode);
    if (!result.ok) {
      Alert.alert(
        'Location needed',
        'Allow location once so we can mark where your hunt began. We do not track your route.'
      );
    }
  };

  const handlePickPredawn = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await setPredawnImage(result.assets[0].uri);
    }
  };

  const runRetrospectiveBootstrap = useCallback(async () => {
    setArrivalFinding(true);
    try {
      if (session?.phase === 'transit') {
        await endHunt();
      }
      const coords = await getCurrentPositionWithTimeout();
      if (!coords) {
        retrospectiveBootstrappedRef.current = false;
        Alert.alert(
          'Location needed',
          'Allow location once so we can name this vantage. We only capture a single point — no route tracking.'
        );
        router.back();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, ARRIVAL_TRANSITION_MS));
      let arrival: VantageArrival;
      try {
        arrival = await Promise.race([
          resolveRetrospectiveVantage(coords),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('geocode_timeout')), GEOCODE_TIMEOUT_MS)
          ),
        ]);
      } catch {
        arrival = {
          vantageCoordinates: coords,
          vantageCity: sunriseCity,
          vantageLabel: "Today's vantage",
          displacementMeters: 0,
        };
      }
      setHuntArrival(arrival);
      setShowLogCard(true);
    } catch {
      retrospectiveBootstrappedRef.current = false;
      Alert.alert('Something went wrong', 'We could not prepare your vantage log. Please try again.');
      router.back();
    } finally {
      setArrivalFinding(false);
    }
  }, [endHunt, router, session?.phase, setShowLogCard, sunriseCity]);

  useEffect(() => {
    if (guardsPending || !isRetrospective || loggedToday) return;
    if (retrospectiveBootstrappedRef.current) return;
    retrospectiveBootstrappedRef.current = true;
    void runRetrospectiveBootstrap();
  }, [guardsPending, isRetrospective, loggedToday, runRetrospectiveBootstrap]);

  const handleArrived = async () => {
    setArrivalFinding(true);
    try {
      const result = await markArrived();
      if (!result.ok) {
        Alert.alert(
          'Location needed',
          'Allow location once so we can name this vantage. We only capture a single point — no route tracking.'
        );
        return;
      }
      const { arrival } = result;
      setHuntArrival(arrival);
      await new Promise((resolve) => setTimeout(resolve, ARRIVAL_TRANSITION_MS));
      requestOpenLog();
    } finally {
      setArrivalFinding(false);
    }
  };

  const handleCloseLog = useCallback(() => {
    closeLog();
    if (isRetrospective) {
      router.replace(ROUTES.today);
    }
  }, [closeLog, isRetrospective, router]);

  useEffect(() => {
    if (!showLogCard) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCloseLog();
      return true;
    });
    return () => sub.remove();
  }, [showLogCard, handleCloseLog]);

  const handleLogSaved = useCallback(
    async (result: SunriseLogSaveResult) => {
      await stashSunriseLogHandoff(result);
      await endHunt();
      setHuntArrival(null);
      await loadLogs();
      router.replace(ROUTES.witness);
    },
    [endHunt, loadLogs, router]
  );

  const phase = session?.phase ?? 'intention';
  const isTransit = phase === 'transit';

  if (guardsPending) {
    return (
      <View style={[styles.container, styles.loadingGate]}>
        <ActivityIndicator size="large" color={Dawn.accent.sunrise} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={
          isMorningLight ? ['#EAF3FB', '#DCEAF7', '#CFE2F3'] : ['#102A43', '#1B3554', '#243F63']
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      <ScreenLayout
        header={
          <SunVantageHeader
            title="Vantage Hunt"
            subtitle={isTransit ? undefined : intentionCopy.headerSubtitle}
            screenTitle
            hideMenu
            showBranding
            wrapperMarginBottom={isTransit ? 4 : undefined}
          />
        }
        enableGentleScrollWhenShort={isTransit}
        scrollContentContainerStyle={[
          styles.scrollContent,
          isTransit && styles.scrollContentTransit,
          showTabBar && { paddingBottom: TAB_BAR_CLEARANCE + 24 },
        ]}
      >
        {isRetrospective ? null : isTransit ? (
          <VantageHuntTransit
            minutesToSunrise={liveMinutesToSunrise}
            sunriseLabel={sunriseLabel}
            city={sunriseCity}
            session={session}
            locationBusy={locationBusy}
            arrivalFinding={arrivalFinding}
            isMorningLight={isMorningLight}
            onPickPredawn={handlePickPredawn}
            onArrived={handleArrived}
          />
        ) : (
          <View style={styles.intentionBlock}>
            <Text style={styles.bodyLead}>{intentionCopy.bodyLead}</Text>
            <Text style={styles.bodySecondary}>
              Different places reveal the sunrise differently.
            </Text>

            <View style={styles.metaBlock}>
              {showCountdown ? <Text style={styles.countdown}>{countdownLabel}</Text> : null}
              <Text style={styles.metaLine}>
                Sunrise {sunriseLabel}
                {sunriseCity ? ` · ${sunriseCity}` : ''}
              </Text>
            </View>

            <Text style={styles.movementLabel}>{intentionCopy.movementLabel}</Text>
            <View style={styles.movementRow}>
              {MOVEMENT_OPTIONS.map((opt) => {
                const active = selectedMode === opt.mode;
                return (
                  <Pressable
                    key={opt.mode}
                    style={({ pressed }) => [
                      styles.movementChip,
                      active && styles.movementChipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setSelectedMode(opt.mode)}
                  >
                    <Text style={styles.movementIcon}>{opt.icon}</Text>
                    <Text style={[styles.movementChipText, active && styles.movementChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={handleBeginHunt}
              disabled={locationBusy}
            >
              {locationBusy ? (
                <ActivityIndicator color={Dawn.accent.sunriseOn} />
              ) : (
                <Text style={styles.ctaText}>{intentionCopy.cta}</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScreenLayout>

      {arrivalFinding ? <VantageHuntArrivalOverlay /> : null}

      <MorningUnfoldingPause visible={showUnfoldingPause} onDismissed={dismissUnfoldingPause} />

      <SunriseLogCard
        visible={showLogCard}
        onClose={handleCloseLog}
        onBlockedBeforeWindow={onLogBlockedEarly}
        onSaved={handleLogSaved}
        onPlanForTomorrow={() => router.push(ROUTES.tomorrow as never)}
        city={huntArrival?.vantageCity ?? sunriseCity}
        sunriseTime={sunriseToday}
        initialVantageName={huntArrival?.vantageLabel ?? null}
        initialCoords={huntArrival?.vantageCoordinates ?? null}
        huntMetadata={
          huntArrival
            ? {
                movementMode: session?.movementMode ?? 'walk',
                displacementMeters: huntArrival.displacementMeters,
                vantageLabel: huntArrival.vantageLabel,
                predawnImageUri: session?.predawnImageUri ?? null,
              }
            : null
        }
        source="hunt"
      />

      {showTabBar ? <RitualTabBarOverlay activeTab="today" /> : null}
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>, _isMorningLight: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Dawn.background.primary,
    },
    loadingGate: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    scrollContent: {
      paddingHorizontal: 28,
      paddingBottom: 48,
      paddingTop: 8,
    },
    scrollContentTransit: {
      paddingTop: 0,
      paddingBottom: 32,
    },
    intentionBlock: {
      paddingTop: 12,
    },
    bodyLead: {
      fontSize: 22,
      lineHeight: 30,
      fontWeight: '500',
      color: Dawn.text.primary,
      marginBottom: 10,
    },
    bodySecondary: {
      fontSize: 16,
      lineHeight: 24,
      color: Dawn.text.secondary,
      opacity: 0.88,
      marginBottom: 32,
    },
    metaBlock: {
      marginBottom: 28,
      gap: 6,
    },
    countdown: {
      fontSize: 15,
      fontWeight: '500',
      color: Dawn.text.primary,
      letterSpacing: 0.2,
    },
    metaLine: {
      fontSize: 14,
      color: Dawn.text.secondary,
      opacity: 0.8,
    },
    movementLabel: {
      fontSize: 13,
      color: Dawn.text.secondary,
      marginBottom: 12,
      letterSpacing: 0.3,
    },
    movementRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 36,
      flexWrap: 'wrap',
    },
    movementChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Dawn.border.subtle,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    movementChipActive: {
      borderColor: 'rgba(200, 220, 244, 0.45)',
      backgroundColor: 'rgba(200, 220, 244, 0.1)',
    },
    movementIcon: {
      fontSize: 15,
    },
    movementChipText: {
      fontSize: 14,
      color: Dawn.text.secondary,
    },
    movementChipTextActive: {
      color: Dawn.text.primary,
      fontWeight: '500',
    },
    cta: {
      alignSelf: 'center',
      paddingVertical: Platform.OS === 'android' ? 12 : 14,
      paddingHorizontal: 32,
      borderRadius: 999,
      backgroundColor: Dawn.accent.sunrise,
      minWidth: 200,
      alignItems: 'center',
    },
    ctaText: {
      fontSize: 16,
      fontWeight: '600',
      color: Dawn.accent.sunriseOn,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}
