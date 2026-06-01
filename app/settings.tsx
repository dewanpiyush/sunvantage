import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import SunVantageHeader from '@/components/SunVantageHeader';
import { useAppTheme } from '@/context/AppThemeContext';
import { useDawn } from '@/hooks/use-dawn';
import ScreenLayout from '@/components/ScreenLayout';
import supabase from '@/supabase';

type Option = {
  id: 'morning-light' | 'night-calm';
  emoji: string;
  label: string;
};

const OPTIONS: Option[] = [
  { id: 'morning-light', emoji: '🌅', label: 'Morning Light' },
  { id: 'night-calm', emoji: '🌌', label: 'Night Calm' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const { mode, setMode } = useAppTheme();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);

  const handleSignOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/auth' as never);
  }, [router]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isMorningLight ? ['#EAF3FB', '#DCEAF7', '#CFE2F3'] : ['#102A43', '#1B3554', '#243F63']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      <ScreenLayout
        header={
          <View style={styles.header}>
            <SunVantageHeader title="Settings" screenTitle showBack backLabel="← Back" onBackPress={() => router.back()} />
            <Text style={styles.headerEmoji} accessibilityLabel="Settings">
              ⚙️
            </Text>
          </View>
        }
        scrollContentContainerStyle={styles.scrollContent}
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.sectionSub}>Choose how SunVantage looks.</Text>

          <View style={styles.optionGroup}>
            {OPTIONS.map((opt, idx) => {
              const selected = mode === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={({ pressed }) => [
                    styles.optionRow,
                    idx === 0 && styles.optionRowFirst,
                    idx === OPTIONS.length - 1 && styles.optionRowLast,
                    selected && styles.optionRowSelected,
                    pressed && styles.optionRowPressed,
                  ]}
                  onPress={() => setMode(opt.id)}
                >
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutWrap, pressed && styles.signOutPressed]}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScreenLayout>
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Dawn.background.primary,
    },
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    header: { marginBottom: 20, position: 'relative' },
    headerEmoji: {
      position: 'absolute',
      right: 24,
      top: 6,
      fontSize: 18,
      opacity: 0.9,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 120,
    },
    sectionCard: {
      backgroundColor: Dawn.surface.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Dawn.border.subtle,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Dawn.text.primary,
      marginBottom: 6,
    },
    sectionSub: {
      fontSize: 13,
      color: Dawn.text.secondary,
      marginBottom: 14,
    },
    optionGroup: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Dawn.border.subtle,
      backgroundColor: Dawn.surfaceSecondary.subtle,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    optionRowFirst: {},
    optionRowLast: {},
    optionRowPressed: { opacity: 0.9 },
    optionRowSelected: {
      backgroundColor: Dawn.surface.card,
    },
    optionEmoji: { fontSize: 18, width: 28 },
    optionLabel: {
      flex: 1,
      fontSize: 15,
      color: Dawn.text.primary,
      fontWeight: '500',
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: Dawn.border.subtle,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    radioOuterSelected: {
      borderColor: Dawn.accent.sunrise,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Dawn.accent.sunrise,
    },
    signOutWrap: {
      marginTop: 34,
      marginBottom: 10,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutPressed: {
      opacity: 0.8,
    },
    signOutText: {
      fontSize: 13,
      fontWeight: '500',
      color: Dawn.text.secondary,
      opacity: 0.72,
      letterSpacing: 0.2,
    },
  });
}

