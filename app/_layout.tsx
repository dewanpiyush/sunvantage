'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import supabase from '@/supabase';
import { usePendingModerationRecoveryOnAppActive } from '@/hooks/use-pending-moderation-recovery-on-app-active';
import { configureNotificationHandler, useNotificationOpenRouting } from '@/lib/notifications';

configureNotificationHandler();

import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import posthog from '../lib/posthog';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchProfileCompleteness } from '@/lib/profileGuard';
import { Dawn } from '@/constants/theme';
import { SPLASH_BACKGROUND } from '@/constants/startup';
import { AppThemeProvider, useAppTheme } from '@/context/AppThemeContext';
import { UIStateProvider } from '@/store/uiState';
import AppBackground from '@/components/AppBackground';
import { SunVantageDarkTheme, SunVantageLightTheme } from '@/lib/navigationTheme';
import { ROUTES } from '@/lib/routes';
import { ThemeProvider } from '@react-navigation/native';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in dev; startup shell still matches native colors.
});

SplashScreen.setOptions({
  duration: 380,
  fade: true,
});

const PUBLIC_PATHS = new Set(['', '/', 'auth', 'onboarding']);
let appOpenedCaptured = false;

function isPublicPath(pathname: string): boolean {
  const segment = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  return PUBLIC_PATHS.has(segment) || PUBLIC_PATHS.has(pathname);
}

function OnboardingGuard({
  children,
  onReadyChange,
}: {
  children: React.ReactNode;
  onReadyChange: (ready: boolean) => void;
}) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      const isPublic = isPublicPath(pathname);

      if (!session?.user?.id) {
        if (!isPublic) {
          router.replace('/');
        }
        setResolving(false);
        return;
      }

      const { complete } = await fetchProfileCompleteness(supabase, session.user.id);
      if (cancelled) return;

      if (!complete && !isPublic) {
        router.replace('/onboarding');
        setResolving(false);
        return;
      }

      if (complete && (pathname === '/' || pathname === '/auth' || pathname === 'auth')) {
        router.replace(ROUTES.today as never);
      } else if (complete && (pathname === '/onboarding' || pathname === 'onboarding')) {
        router.replace(ROUTES.today as never);
      }

      setResolving(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    onReadyChange(!resolving);
  }, [resolving, onReadyChange]);

  if (resolving && !isPublicPath(pathname)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Dawn.accent.sunrise} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { colorScheme: appScheme } = useAppTheme();
  const scheme = appScheme ?? colorScheme;
  const router = useRouter();
  const [shellReady, setShellReady] = useState(false);
  const [guardReady, setGuardReady] = useState(false);

  useNotificationOpenRouting(router);
  usePendingModerationRecoveryOnAppActive(supabase);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(SPLASH_BACKGROUND).catch(() => {});
  }, []);

  useEffect(() => {
    if (appOpenedCaptured) return;
    appOpenedCaptured = true;
    try {
      if (posthog) posthog.capture('app_opened');
    } catch {
      // ignore analytics errors
    }
  }, []);

  useEffect(() => {
    if (!shellReady || !guardReady) return;
    void SplashScreen.hideAsync();
  }, [shellReady, guardReady]);

  const onGuardReadyChange = useCallback((ready: boolean) => {
    setGuardReady(ready);
  }, []);

  const onShellLayout = useCallback(() => {
    setShellReady(true);
  }, []);

  const navTheme = scheme === 'dark' ? SunVantageDarkTheme : SunVantageLightTheme;

  return (
    <View style={styles.shell} onLayout={onShellLayout}>
      <ThemeProvider value={navTheme}>
        <AppBackground>
          <OnboardingGuard onReadyChange={onGuardReadyChange}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </OnboardingGuard>
        </AppBackground>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <UIStateProvider>
        <RootLayoutInner />
      </UIStateProvider>
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SPLASH_BACKGROUND,
  },
});
