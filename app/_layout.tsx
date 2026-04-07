'use client';

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import supabase from '@/supabase';
import { usePendingModerationRecoveryOnAppActive } from '@/hooks/use-pending-moderation-recovery-on-app-active';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import posthog from '../lib/posthog';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchProfileCompleteness } from '@/lib/profileGuard';
import { Dawn } from '@/constants/theme';
import { AppThemeProvider, useAppTheme } from '@/context/AppThemeContext';
import { UIStateProvider } from '@/store/uiState';
import AppBackground from '@/components/AppBackground';

const PUBLIC_PATHS = new Set(['', '/', 'auth', 'onboarding']);
let appOpenedCaptured = false;

function isPublicPath(pathname: string): boolean {
  const segment = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  return PUBLIC_PATHS.has(segment) || PUBLIC_PATHS.has(pathname);
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
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
        router.replace('/home');
      } else if (complete && (pathname === '/onboarding' || pathname === 'onboarding')) {
        router.replace('/home');
      }

      setResolving(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (resolving && !isPublicPath(pathname)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Dawn.accent.sunrise} />
      </View>
    );
  }

  return <>{children}</>;
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

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { colorScheme: appScheme } = useAppTheme();
  const scheme = appScheme ?? colorScheme;

  /** Pending sunrise moderation when app foregrounds (any screen), not only Home focus. */
  usePendingModerationRecoveryOnAppActive(supabase);

  // PostHog: fire exactly once when the app loads.
  useEffect(() => {
    if (appOpenedCaptured) return;
    appOpenedCaptured = true;
    try {
      if (posthog) posthog.capture('app_opened');
    } catch {
      // ignore analytics errors
    }
  }, []);

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppBackground>
        <OnboardingGuard>
          <Stack screenOptions={{ headerShown: false }}>
            {/* All routes in the `app` folder (index, auth, onboarding, tabs, etc.)
                are automatically registered by expo-router. */}
          </Stack>
        </OnboardingGuard>
      </AppBackground>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Dawn.background.primary,
  },
});
