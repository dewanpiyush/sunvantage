import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '@/context/AppThemeContext';
import type { AppAppearanceMode } from '@/constants/theme';
import { useDawn } from '@/hooks/use-dawn';

const OPTIONS: { id: AppAppearanceMode; emoji: string; label: string }[] = [
  { id: 'morning-light', emoji: '🌅', label: 'Morning Light' },
  { id: 'night-calm', emoji: '🌌', label: 'Night Calm' },
];

export default function AppearanceModeToggle() {
  const Dawn = useDawn();
  const { mode, setMode } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Appearance</Text>
      <View style={styles.segmentRow}>
        {OPTIONS.map((opt) => {
          const selected = mode === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={({ pressed }) => [
                styles.segment,
                selected && styles.segmentSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => setMode(opt.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
            >
              <Text style={styles.segmentEmoji}>{opt.emoji}</Text>
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
    wrap: {
      paddingVertical: 4,
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      color: Dawn.text.secondary,
      opacity: 0.85,
      marginBottom: 8,
      letterSpacing: 0.2,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: 8,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Dawn.border.subtle,
      backgroundColor: Dawn.surfaceSecondary.subtle,
    },
    segmentSelected: {
      borderColor: 'rgba(255, 179, 71, 0.35)',
      backgroundColor: Dawn.surface.card,
    },
    segmentEmoji: {
      fontSize: 15,
    },
    segmentLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: Dawn.text.secondary,
    },
    segmentLabelSelected: {
      color: Dawn.text.primary,
      fontWeight: '600',
    },
    pressed: { opacity: 0.88 },
  });
}
