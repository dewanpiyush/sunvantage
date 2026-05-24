/**
 * Local sunrise reminders — handler, Android channel, and tap-to-open routing.
 */

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Router } from 'expo-router';

export const SUNRISE_REMINDER_CHANNEL_ID = 'sunrise-reminders';

/** Deep-link path when user taps a sunrise reminder (expo-router). */
export const SUNRISE_REMINDER_PATH = '/sunrise';

let handlerConfigured = false;

export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function getPathFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const path = (data as { path?: unknown }).path;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}

export async function ensureSunriseReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SUNRISE_REMINDER_CHANNEL_ID, {
    name: 'Sunrise reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 200],
  });
}

export async function scheduleSunriseReminder(reminderDate: Date): Promise<void> {
  await ensureSunriseReminderChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SunVantage',
      body: 'The morning is arriving.',
      sound: true,
      data: { path: SUNRISE_REMINDER_PATH },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      ...(Platform.OS === 'android' ? { channelId: SUNRISE_REMINDER_CHANNEL_ID } : {}),
    },
  });
}

/** Route into the app when the user taps a reminder (foreground, background, or cold start). */
export function useNotificationOpenRouting(router: Router): void {
  useEffect(() => {
    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const path = getPathFromNotificationData(response.notification.request.content.data);
      if (path) router.push(path as never);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);

    void Notifications.getLastNotificationResponseAsync()
      .then(openFromResponse)
      .catch(() => {});

    return () => subscription.remove();
  }, [router]);
}
