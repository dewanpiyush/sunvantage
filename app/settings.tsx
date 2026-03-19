import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import SunVantageHeader from '@/components/SunVantageHeader';
import { useAppTheme } from '@/context/AppThemeContext';
import { useDawn } from '@/hooks/use-dawn';

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
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);

  return (
    <View style={styles.container}>
      <View style={styles.gradientTop} pointerEvents="none" />
      <View style={styles.gradientMid} pointerEvents="none" />
      <View style={styles.gradientLowerWarm} pointerEvents="none" />

      <View style={styles.header}>
        <SunVantageHeader title="Settings" screenTitle onHeaderPress={() => router.push('/home')} />
        <Text style={styles.headerEmoji} accessibilityLabel="Settings">
          ⚙️
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
      </ScrollView>
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
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
    header: {
      paddingHorizontal: 24,
      marginBottom: 20,
      position: 'relative',
    },
    headerEmoji: {
      position: 'absolute',
      right: 24,
      top: 6,
      fontSize: 18,
      opacity: 0.9,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 48,
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
  });
}

