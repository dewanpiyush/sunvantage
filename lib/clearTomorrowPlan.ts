/**
 * Clear the stored tomorrow plan (location, reminder time, alarm set).
 * Call when the user logs today's sunrise so the plan resets for the next day.
 * Also cancels any scheduled reminder notification.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const TOMORROW_INTENTION_KEY = 'sunvantage_tomorrow_intention';
const TOMORROW_ALARM_SET_KEY = 'sunvantage_tomorrow_alarm_set';
const TOMORROW_ALARM_TIME_KEY = 'sunvantage_tomorrow_alarm_time';

export async function clearTomorrowPlan(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(TOMORROW_INTENTION_KEY),
      AsyncStorage.removeItem(TOMORROW_ALARM_SET_KEY),
      AsyncStorage.removeItem(TOMORROW_ALARM_TIME_KEY),
    ]);
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
