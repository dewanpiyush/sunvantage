import React, { useEffect, useState, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import supabase from '../supabase';
import SunVantageHeader from '../components/SunVantageHeader';
import StreakBlock from '../components/StreakBlock';
import DawnInvitationSection from '../components/DawnInvitationSection';
import { useMorningContext } from '../hooks/useMorningContext';
import { Dawn } from '../constants/theme';

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

/** Returns weather line and optional second line for sunrise card. todayMorning: "this morning" vs "tomorrow morning". */
function getSunriseWeatherCopy(
  tomorrowWeather: string | null,
  todayMorning: boolean
): { weatherLine: string; optionalLine?: string } {
  if (todayMorning) {
    switch (tomorrowWeather) {
      case 'clear':
        return { weatherLine: 'Clear skies expected this morning.' };
      case 'cloudy':
        return {
          weatherLine: 'Clouds expected this morning.',
          optionalLine: 'But dawn walks are still worth it.',
        };
      case 'rain':
        return { weatherLine: 'Rain may arrive this morning.' };
      case 'storm':
        return { weatherLine: 'Stormy weather may arrive this morning.' };
      default:
        return { weatherLine: 'This morning awaits.' };
    }
  }
  switch (tomorrowWeather) {
    case 'clear':
      return { weatherLine: 'Clear skies expected tomorrow morning.' };
    case 'cloudy':
      return {
        weatherLine: 'Clouds expected tomorrow morning.',
        optionalLine: 'But dawn walks are still worth it.',
      };
    case 'rain':
      return { weatherLine: 'Rain may arrive tomorrow morning.' };
    case 'storm':
      return { weatherLine: 'Stormy weather may arrive tomorrow morning.' };
    default:
      return { weatherLine: 'Tomorrow morning awaits.' };
  }
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
  const [profile, setProfile] = useState<{ city: string | null; current_streak: number; longest_streak: number } | null>(null);
  const [streakLoading, setStreakLoading] = useState(true);
  const [intention, setIntention] = useState('');
  const [reminderMinsBefore, setReminderMinsBefore] = useState(DEFAULT_MINS_BEFORE_SUNRISE);
  const [alarmScheduled, setAlarmScheduled] = useState(false);
  const [alarmTime, setAlarmTime] = useState<string | null>(null);
  const [showReminderUpdated, setShowReminderUpdated] = useState(false);

  const { sunriseToday, sunriseTomorrow, minutesToSunrise, sunriseCardTimeMessage, isDawnMode, tomorrowWeather } = useMorningContext(profile?.city ?? null);
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
      setShowReminderUpdated(true);
      setTimeout(() => setShowReminderUpdated(false), 2000);
    } catch (e) {
      Alert.alert('Could not set reminder', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [reminderDate, reminderTimeFormatted]);

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
        setShowReminderUpdated(true);
        setTimeout(() => setShowReminderUpdated(false), 2000);
      } catch {
        // ignore
      }
    },
    [reminderMinsBefore, sunriseTomorrow, sunriseToday, isTodayMode]
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

  const { weatherLine, optionalLine } = getSunriseWeatherCopy(tomorrowWeather, isTodayMode);

  return (
    <View style={styles.container}>
      <View style={styles.gradientTop} pointerEvents="none" />
      <View style={styles.gradientMid} pointerEvents="none" />
      <View style={styles.gradientLowerWarm} pointerEvents="none" />

      <SunVantageHeader
        showBack
        hideMenu
        showBranding
        title={isTodayMode ? 'Today morning' : 'Tomorrow morning'}
        subtitle={isTodayMode ? 'Dawn is approaching.' : 'The sun will rise again.'}
      />

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

          {/* Sunrise card — Today or Tomorrow mode */}
          <View style={styles.sunriseContextCard}>
            <Text style={styles.sunriseContextCardTitle}>
              ☀ {isTodayMode ? "Today's sunrise" : "Tomorrow's sunrise"}
            </Text>
            <Text style={styles.sunriseContextCardBody}>
              Sunrise in {cityName || 'your city'} will be at {formatSunriseTime(sunriseDisplay)}.
            </Text>
            {isTodayMode && sunriseCardTimeMessage != null ? (
              <Text style={styles.sunriseContextCardBody}>{sunriseCardTimeMessage}</Text>
            ) : null}
            <Text style={[styles.sunriseContextCardBody, !optionalLine && styles.sunriseContextCardBodyLast]}>
              {weatherLine}
            </Text>
            {optionalLine ? (
              <Text style={styles.sunriseContextCardSub}>{optionalLine}</Text>
            ) : null}
          </View>

          {/* Intention input */}
          <Text style={styles.prompt}>
            Where might you welcome the first light {isTodayMode ? 'today' : 'tomorrow'}?
          </Text>
          <TextInput
            style={styles.input}
            value={intention}
            onChangeText={saveIntention}
            placeholder="Balcony"
            placeholderTextColor={Dawn.text.secondary}
            returnKeyType="done"
          />

          {/* Sunrise reminder card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Wake up for the ritual.</Text>
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
              <View style={styles.adjustRow}>
                <Pressable
                  style={styles.adjustBtn}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(-10) : adjustReminder(-10))}
                >
                  <Text style={styles.adjustBtnText}>−10</Text>
                </Pressable>
                <Pressable
                  style={styles.adjustBtn}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(-5) : adjustReminder(-5))}
                >
                  <Text style={styles.adjustBtnText}>−5</Text>
                </Pressable>
                <View style={styles.reminderTimesBlock}>
                  <Text style={styles.reminderTimesLine}>
                    Sunrise: {formatSunriseTime(sunriseDisplay)}
                  </Text>
                  <Text style={styles.reminderTimesLine}>
                    Reminder: {reminderTimeFormatted ?? '—'}
                  </Text>
                </View>
                <Pressable
                  style={styles.adjustBtn}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(5) : adjustReminder(5))}
                >
                  <Text style={styles.adjustBtnText}>+5</Text>
                </Pressable>
                <Pressable
                  style={styles.adjustBtn}
                  onPress={() => (alarmTime != null ? adjustReminderAndReschedule(10) : adjustReminder(10))}
                >
                  <Text style={styles.adjustBtnText}>+10</Text>
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
          <Text style={styles.closing}>You don't have to capture it. Just notice it.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
    paddingTop: 52,
  },
  gradientTop: {
    ...StyleSheet.absoluteFillObject,
    height: '50%',
    backgroundColor: Dawn.background.primary,
  },
  gradientMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '35%',
    height: '30%',
    backgroundColor: 'rgba(148, 163, 184, 0.055)',
  },
  gradientLowerWarm: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    bottom: 0,
    backgroundColor: 'rgba(255, 179, 71, 0.058)',
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
    paddingTop: 12,
  },
  streakWrap: {
    marginTop: 12,
    marginBottom: 16,
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
  sunriseContextCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  sunriseContextCardBody: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  sunriseContextCardBodyLast: {
    marginBottom: 12,
  },
  sunriseContextCardSub: {
    fontSize: 14,
    color: Dawn.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  card: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  prompt: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.primary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Dawn.text.primary,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
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
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 14,
    gap: 8,
  },
  adjustBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  adjustBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  reminderTimesBlock: {
    minWidth: 120,
    alignItems: 'center',
  },
  reminderTimesLine: {
    fontSize: 13,
    color: Dawn.text.secondary,
    textAlign: 'center',
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
