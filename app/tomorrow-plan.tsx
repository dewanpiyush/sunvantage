import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import StreakBlock from '../components/StreakBlock';
import DawnInvitationSection from '../components/DawnInvitationSection';
import { useMorningContext } from '../hooks/useMorningContext';
import { useDawn } from '@/hooks/use-dawn';
import { useAppTheme } from '@/context/AppThemeContext';
import posthog from '@/lib/posthog';

const TOMORROW_INTENTION_KEY = 'sunvantage_tomorrow_intention';
export const TOMORROW_ALARM_SET_KEY = 'sunvantage_tomorrow_alarm_set';
export const TOMORROW_ALARM_TIME_KEY = 'sunvantage_tomorrow_alarm_time';
const DEFAULT_MINS_BEFORE_SUNRISE = 15;
const MIN_MINS_BEFORE = 5;
const MAX_MINS_BEFORE = 30;

/** Format "HH:mm" as "h:mm AM/PM" for display. */
function formatSunriseTime(hhmm: string | null): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm ?? '—';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr!, 10);
  const m = mStr!;
  const ampm = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Parse "HH:mm" and return tomorrow at that time (local), then subtract minutes. Returns null if invalid. */
function getReminderDate(sunriseHHmm: string | null, minutesBeforeSunrise: number): Date | null {
  if (!sunriseHHmm || !/^\d{1,2}:\d{2}$/.test(sunriseHHmm)) return null;
  const [hStr, mStr] = sunriseHHmm.split(':');
  const hours = parseInt(hStr!, 10);
  const minutes = parseInt(mStr!, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours, minutes, 0, 0);
  const reminder = new Date(tomorrow.getTime() - minutesBeforeSunrise * 60 * 1000);
  return reminder;
}

/** Parse "HH:mm" and return today at that time (local), then subtract minutes. Returns null if invalid. */
function getReminderDateForToday(sunriseHHmm: string | null, minutesBeforeSunrise: number): Date | null {
  if (!sunriseHHmm || !/^\d{1,2}:\d{2}$/.test(sunriseHHmm)) return null;
  const [hStr, mStr] = sunriseHHmm.split(':');
  const hours = parseInt(hStr!, 10);
  const minutes = parseInt(mStr!, 10);
  const today = new Date();
  today.setHours(hours, minutes, 0, 0);
  const reminder = new Date(today.getTime() - minutesBeforeSunrise * 60 * 1000);
  return reminder;
}

function formatReminderTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Observational weather line (less “forecast app”, more noticing). */
function getSunriseWeatherLine(weather: string | null): string {
  switch (weather) {
    case 'clear':
      return 'Clear skies expected at dawn.';
    case 'cloudy':
      return 'Clouds expected at dawn.';
    case 'rain':
      return 'Rain expected at dawn.';
    case 'storm':
      return 'Stormy conditions possible at dawn.';
    default:
      return 'Dawn awaits.';
  }
}

function getPlaceLeadingEmoji(place: string): string {
  const n = place.trim().toLowerCase();
  const homeLike = ['home', 'room', 'balcony', 'terrace', 'window', 'yard'];
  if (homeLike.some((w) => n === w || n.split(/\s+/).includes(w))) return '🏠';
  return '📍';
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function TomorrowPlanScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn, mode]);
  const [profile, setProfile] = useState<{ city: string | null; current_streak: number; longest_streak: number } | null>(null);
  const [streakLoading, setStreakLoading] = useState(true);
  const [intention, setIntention] = useState('');
  const [placeFieldFocused, setPlaceFieldFocused] = useState(false);
  const [reminderMinsBefore, setReminderMinsBefore] = useState(DEFAULT_MINS_BEFORE_SUNRISE);
  const [alarmScheduled, setAlarmScheduled] = useState(false);
  const [alarmTime, setAlarmTime] = useState<string | null>(null);
  const [showReminderUpdated, setShowReminderUpdated] = useState(false);
  const lastNextSunriseIntentKeyRef = useRef<string | null>(null);

  const { sunriseToday, sunriseTomorrow, minutesToSunrise, isDawnMode, tomorrowWeather } = useMorningContext(profile?.city ?? null);
  const cityName = profile?.city ?? null;

  const isTodayMode = minutesToSunrise != null && minutesToSunrise > 0;
  const sunriseDisplay = isTodayMode ? sunriseToday : sunriseTomorrow;
  const reminderDate = isTodayMode
    ? getReminderDateForToday(sunriseToday, reminderMinsBefore)
    : getReminderDate(sunriseTomorrow, reminderMinsBefore);
  const reminderTimeFormatted = reminderDate ? formatReminderTime(reminderDate) : null;
  const reminderHasPassed = reminderDate != null && reminderDate.getTime() <= Date.now();

  const loadProfile = useCallback(async () => {
    setStreakLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('city, current_streak, longest_streak')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) {
        const current = typeof data.current_streak === 'number' ? data.current_streak : typeof data.current_streak === 'string' ? parseInt(data.current_streak, 10) : 0;
        const longest = typeof data.longest_streak === 'number' ? data.longest_streak : typeof data.longest_streak === 'string' ? parseInt(data.longest_streak, 10) : 0;
        setProfile({ city: data.city ?? null, current_streak: Number.isNaN(current) ? 0 : current, longest_streak: Number.isNaN(longest) ? 0 : longest });
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setStreakLoading(false);
    }
  }, []);

  const loadIntention = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(TOMORROW_INTENTION_KEY);
      setIntention(value ?? '');
    } catch {
      setIntention('');
    }
  }, []);

  const saveIntention = useCallback(async (value: string) => {
    setIntention(value);
    try {
      await AsyncStorage.setItem(TOMORROW_INTENTION_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  const scheduleSunriseAlarm = useCallback(async () => {
    if (!reminderDate || reminderDate.getTime() <= Date.now()) {
      Alert.alert('Unable to set', 'Sunrise time is in the past or missing. Try again tomorrow.');
      return;
    }
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (status !== 'granted') {
        const { status: requested } = await Notifications.requestPermissionsAsync();
        status = requested;
      }
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Enable notifications to get a sunrise reminder.');
        return;
      }
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'SunVantage',
          body: 'The morning is arriving.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });
      setAlarmScheduled(true);
      if (reminderTimeFormatted) setAlarmTime(reminderTimeFormatted);
      try {
        await AsyncStorage.setItem(TOMORROW_ALARM_SET_KEY, '1');
        if (reminderTimeFormatted) {
          await AsyncStorage.setItem(TOMORROW_ALARM_TIME_KEY, reminderTimeFormatted);
        }
      } catch {
        // ignore
      }

      // PostHog: user confirmed next sunrise intent (alarm scheduled successfully).
      try {
        const key = `${intention.trim()}|${reminderDate?.toISOString() ?? ''}`;
        if (lastNextSunriseIntentKeyRef.current !== key) {
          lastNextSunriseIntentKeyRef.current = key;
          if (posthog) posthog.capture('next_sunrise_intent_set');
        }
      } catch {
        // ignore analytics failures
      }

      setShowReminderUpdated(true);
      setTimeout(() => setShowReminderUpdated(false), 2000);
    } catch (e) {
      Alert.alert('Could not set reminder', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [reminderDate, reminderTimeFormatted, intention]);

  const adjustReminder = useCallback((delta: number) => {
    setReminderMinsBefore((prev) => Math.min(MAX_MINS_BEFORE, Math.max(MIN_MINS_BEFORE, prev + delta)));
  }, []);

  const adjustReminderAndReschedule = useCallback(
    async (delta: number) => {
      const newOffset = Math.min(MAX_MINS_BEFORE, Math.max(MIN_MINS_BEFORE, reminderMinsBefore + delta));
      const newReminderDate = isTodayMode
        ? getReminderDateForToday(sunriseToday, newOffset)
        : getReminderDate(sunriseTomorrow, newOffset);
      if (!newReminderDate || newReminderDate.getTime() <= Date.now()) return;
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (status !== 'granted') {
          const { status: requested } = await Notifications.requestPermissionsAsync();
          status = requested;
        }
        if (status !== 'granted') return;
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'SunVantage',
            body: 'The morning is arriving.',
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: newReminderDate,
          },
        });
        const newTimeFormatted = formatReminderTime(newReminderDate);
        setReminderMinsBefore(newOffset);
        setAlarmScheduled(true);
        setAlarmTime(newTimeFormatted);
        try {
          await AsyncStorage.setItem(TOMORROW_ALARM_SET_KEY, '1');
          await AsyncStorage.setItem(TOMORROW_ALARM_TIME_KEY, newTimeFormatted);
        } catch {
          // ignore
        }

        // PostHog: user confirmed intent again (alarm rescheduled successfully).
        try {
          const key = `${intention.trim()}|${newReminderDate?.toISOString() ?? ''}`;
          if (lastNextSunriseIntentKeyRef.current !== key) {
            lastNextSunriseIntentKeyRef.current = key;
            if (posthog) posthog.capture('next_sunrise_intent_set');
          }
        } catch {
          // ignore analytics failures
        }

        setShowReminderUpdated(true);
        setTimeout(() => setShowReminderUpdated(false), 2000);
      } catch {
        // ignore
      }
    },
    [reminderMinsBefore, sunriseTomorrow, sunriseToday, isTodayMode, intention]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadIntention();
  }, [loadIntention]);

  useEffect(() => {
    (async () => {
      try {
        const [set, storedTime] = await Promise.all([
          AsyncStorage.getItem(TOMORROW_ALARM_SET_KEY),
          AsyncStorage.getItem(TOMORROW_ALARM_TIME_KEY),
        ]);
        if (!reminderDate) return;
        if (reminderDate.getTime() > Date.now()) {
          if (set === '1') {
            setAlarmScheduled(true);
            if (storedTime?.trim()) setAlarmTime(storedTime.trim());
          }
        } else {
          await AsyncStorage.removeItem(TOMORROW_ALARM_SET_KEY);
          await AsyncStorage.removeItem(TOMORROW_ALARM_TIME_KEY);
          setAlarmScheduled(false);
          setAlarmTime(null);
        }
      } catch {
        // ignore
      }
    })();
  }, [reminderDate]);

  const weatherLineShort = getSunriseWeatherLine(tomorrowWeather);

  return (
    <View style={styles.container} key={mode}>
      <LinearGradient
        colors={mode === 'morning-light' ? ['#EAF3FB', '#DCEAF7', '#CFE2F3'] : ['#102A43', '#1B3554', '#243F63']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <SunVantageHeader
          title={isTodayMode ? 'Today morning' : 'Plan Tomorrow'}
          subtitle={isTodayMode ? 'Dawn is approaching.' : 'The sun will rise again.'}
          hasLoggedToday={false}
          wrapperMarginBottom={0}
          screenTitle
          onHeaderPress={() => router.push('/home')}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Streak — same as Home, directly under header */}
          <View style={styles.streakWrap}>
            <StreakBlock
              currentStreak={profile?.current_streak ?? 0}
              longestStreak={profile?.longest_streak ?? 0}
              loading={streakLoading}
              style={styles.streakBlockSpacing}
            />
          </View>

          {/* Sunrise card — two-line: city • time, then weather */}
          <View style={styles.sunriseContextCard}>
            <View style={styles.sunTitleRow}>
              <Text style={styles.sunEmoji}>🌅</Text>
              <Text style={styles.sunTitle}>
                {isTodayMode ? "Today's sunrise" : "Tomorrow's sunrise"}
              </Text>
            </View>
            <Text style={styles.sunriseContextCardTime}>
              {cityName || 'Your city'} • {formatSunriseTime(sunriseDisplay)}
            </Text>
            <Text style={styles.sunriseContextCardWeather}>{weatherLineShort}</Text>
          </View>

          {/* Place — pill chip (memory / quick edit), not a form field */}
          <Text style={styles.prompt}>Where will you greet the sunrise?</Text>
          <View style={styles.placeChip}>
            <Text style={styles.placeChipEmoji}>{intention.trim() ? getPlaceLeadingEmoji(intention) : '📍'}</Text>
            <TextInput
              style={styles.placeChipInput}
              value={intention}
              onChangeText={saveIntention}
              placeholder={placeFieldFocused ? '' : 'Balcony'}
              placeholderTextColor={Dawn.text.secondary}
              onFocus={() => setPlaceFieldFocused(true)}
              onBlur={() => setPlaceFieldFocused(false)}
              returnKeyType="done"
              underlineColorAndroid="transparent"
            />
          </View>
          <Text style={styles.placeChipHint}>Tap to edit</Text>

          {/* Sunrise reminder card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Be there for the morning.</Text>
            {alarmTime != null ? (
              <>
                <Text style={styles.cardDesc}>
                  {reminderHasPassed ? `Reminder was set for ${alarmTime}.` : `Reminder set for ${alarmTime}.`}
                </Text>
                <Text style={styles.cardDesc}>
                  {reminderHasPassed ? "You're already up." : "You'll be notified before sunrise."}
                </Text>
              </>
            ) : (
              <Text style={styles.cardDesc}>Set a gentle reminder before dawn.</Text>
            )}
            {reminderTimeFormatted && !isDawnMode && (
              <View style={styles.reminderTunerRow}>
                <Pressable
                  style={({ pressed }) => [styles.tunerBtn, pressed && styles.tunerBtnPressed]}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(-10) : adjustReminder(-10))}
                >
                  <Text style={styles.tunerBtnText}>−10</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.tunerBtn, pressed && styles.tunerBtnPressed]}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(-5) : adjustReminder(-5))}
                >
                  <Text style={styles.tunerBtnText}>−5</Text>
                </Pressable>
                <View style={styles.tunerCenter}>
                  <Text style={styles.tunerCenterText}>
                    <Text style={styles.tunerCenterMuted}>Reminder: </Text>
                    <Text style={styles.tunerCenterTime}>{reminderTimeFormatted}</Text>
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.tunerBtn, pressed && styles.tunerBtnPressed]}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(5) : adjustReminder(5))}
                >
                  <Text style={styles.tunerBtnText}>+5</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.tunerBtn, pressed && styles.tunerBtnPressed]}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(10) : adjustReminder(10))}
                >
                  <Text style={styles.tunerBtnText}>+10</Text>
                </Pressable>
              </View>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.cardButton,
                pressed && styles.cardButtonPressed,
                (!reminderDate || reminderDate.getTime() <= Date.now()) && styles.cardButtonDisabled,
              ]}
              onPress={scheduleSunriseAlarm}
              disabled={!reminderDate || reminderDate.getTime() <= Date.now()}
            >
              <Text style={styles.cardButtonText}>
                {alarmTime != null ? 'Update Reminder' : 'Set Reminder'}
              </Text>
            </Pressable>
            {showReminderUpdated && (
              <Text style={styles.reminderUpdatedText}>Reminder updated.</Text>
            )}
          </View>

          {/* Invite section */}
          <DawnInvitationSection city={cityName} sunriseTomorrow={sunriseTomorrow} />

          {/* Closing text */}
          <Text style={styles.closing}>You don{"'"}t have to capture it. Just notice it.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  titleRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sunTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sunEmoji: {
    fontSize: 18,
  },
  sunTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  sunriseContextCardTime: {
    fontSize: 15,
    color: Dawn.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  sunriseContextCardWeather: {
    fontSize: 13,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  titleEmoji: {
    fontSize: 17,
    lineHeight: 22,
  },
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
    paddingTop: 52,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    paddingHorizontal: 24,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 8,
  },
  streakWrap: {
    marginTop: 8,
    marginBottom: 12,
  },
  streakBlockSpacing: {
    marginTop: 0,
    marginBottom: 0,
  },
  /* Same card style as Home "Today's sunrise" card */
  sunriseContextCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Dawn.border.sunriseCard,
    shadowColor: Dawn.accent.sunrise,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  card: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
  },
  prompt: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.primary,
    marginBottom: 8,
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Dawn.surfaceSecondary.subtle,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    alignSelf: 'stretch',
    gap: 8,
  },
  placeChipEmoji: {
    fontSize: 16,
  },
  placeChipInput: {
    flex: 1,
    fontSize: 15,
    color: Dawn.text.primary,
    paddingVertical: 0,
    margin: 0,
    minHeight: 22,
  },
  placeChipHint: {
    fontSize: 12,
    color: Dawn.text.secondary,
    opacity: 0.75,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  reminderTunerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
    gap: 4,
  },
  tunerBtn: {
    paddingVertical: 7,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: Dawn.surfaceSecondary.subtle,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tunerBtnPressed: {
    opacity: 0.88,
  },
  tunerBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: Dawn.text.secondary,
  },
  tunerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    minWidth: 0,
  },
  tunerCenterText: {
    textAlign: 'center',
  },
  tunerCenterMuted: {
    fontSize: 13,
    color: Dawn.text.secondary,
  },
  tunerCenterTime: {
    fontSize: 14,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  cardButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
  },
  cardButtonPressed: {
    opacity: 0.92,
  },
  cardButtonDisabled: {
    opacity: 0.5,
  },
  cardButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.accent.sunriseOn,
  },
  reminderUpdatedText: {
    marginTop: 10,
    fontSize: 13,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  closing: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  });
}
