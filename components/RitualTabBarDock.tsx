import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/AppThemeContext';
import { useDawn } from '@/hooks/use-dawn';

export const RITUAL_TAB_ORDER = ['today', 'tomorrow', 'community', 'you'] as const;

export type RitualTabKey = (typeof RITUAL_TAB_ORDER)[number];

export const RITUAL_TAB_META: Record<RitualTabKey, { label: string; icon: string }> = {
  today: { label: 'Today', icon: '☀️' },
  tomorrow: { label: 'Tomorrow', icon: '🌅' },
  community: { label: 'Community', icon: '🌍' },
  you: { label: 'You', icon: '✨' },
};

/** Expo Router may register nested hubs as `community/index` — normalize to tab key. */
export function ritualTabKeyFromRouteName(name: string): RitualTabKey | null {
  const base = name.split('/')[0]?.trim().toLowerCase() ?? '';
  if (base === 'today' || base === 'tomorrow' || base === 'community' || base === 'you') {
    return base;
  }
  return null;
}

export type RitualTabBarDockProps = {
  activeTab: RitualTabKey;
  onTabPress: (tab: RitualTabKey) => void;
  /** Optional per-tab accessibility labels (from React Navigation descriptors). */
  accessibilityLabels?: Partial<Record<RitualTabKey, string>>;
};

export function RitualTabBarDock({ activeTab, onTabPress, accessibilityLabels }: RitualTabBarDockProps) {
  const insets = useSafeAreaInsets();
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn, isMorningLight), [Dawn, isMorningLight]);

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.dock}>
        {RITUAL_TAB_ORDER.map((key) => {
          const meta = RITUAL_TAB_META[key];
          const isFocused = activeTab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={accessibilityLabels?.[key] ?? meta.label}
              onPress={() => onTabPress(key)}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >
              {isFocused ? <View style={styles.activeGlow} pointerEvents="none" /> : null}
              <Text style={[styles.icon, isFocused && styles.iconActive]}>{meta.icon}</Text>
              <Text style={[styles.label, isFocused && styles.labelActive]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>, isMorningLight: boolean) {
  return StyleSheet.create({
    outer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      zIndex: 20,
    },
    dock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 28,
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: isMorningLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(14, 34, 61, 0.88)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isMorningLight ? Dawn.border.subtle : 'rgba(255, 179, 71, 0.12)',
      ...Platform.select({
        ios: {
          shadowColor: isMorningLight ? 'rgba(31, 42, 55, 0.18)' : '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isMorningLight ? 0.14 : 0.28,
          shadowRadius: isMorningLight ? 12 : 16,
        },
        android: { elevation: isMorningLight ? 6 : 10 },
      }),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      borderRadius: 20,
      overflow: 'hidden',
    },
    tabPressed: {
      opacity: 0.88,
    },
    activeGlow: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isMorningLight ? 'rgba(245, 166, 35, 0.14)' : 'rgba(255, 179, 71, 0.1)',
      borderRadius: 20,
    },
    icon: {
      fontSize: 17,
      opacity: isMorningLight ? 0.5 : 0.55,
      marginBottom: 3,
    },
    iconActive: {
      opacity: 1,
    },
    label: {
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.2,
      color: Dawn.text.secondary,
      opacity: 0.72,
    },
    labelActive: {
      color: Dawn.text.primary,
      opacity: 1,
    },
  });
}
