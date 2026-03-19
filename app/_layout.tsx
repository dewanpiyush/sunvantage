import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchProfileCompleteness } from '@/lib/profileGuard';
import supabase from '@/supabase';
import { Dawn } from '@/constants/theme';
import { AppThemeProvider, useAppTheme } from '@/context/AppThemeContext';

const PUBLIC_PATHS = new Set(['', '/', 'auth', 'onboarding']);

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
      <RootLayoutInner />
    </AppThemeProvider>
  );
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { colorScheme: appScheme } = useAppTheme();
  const scheme = appScheme ?? colorScheme;

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OnboardingGuard>
        <Stack screenOptions={{ headerShown: false }}>
          {/* All routes in the `app` folder (index, auth, onboarding, tabs, etc.)
              are automatically registered by expo-router. */}
        </Stack>
      </OnboardingGuard>
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
