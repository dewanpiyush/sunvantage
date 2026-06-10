import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '@/context/AppThemeContext';
import type { AppAppearanceMode } from '@/constants/theme';
import { useDawn } from '@/hooks/use-dawn';

const OPTIONS: { id: AppAppearanceMode; emoji: string; label: string }[] = [
  { id: 'morning-light', emoji: '🌅', label: 'Morning Light' },
  { id: 'night-calm', emoji: '🌌', label: 'Night Calm' },
];

type Props = {
  /** You-tab: narrower toggles, “Atmosphere” label, centered within the card column. */
  layout?: 'default' | 'hub';
};

export default function AppearanceModeToggle({ layout = 'default' }: Props) {
  const Dawn = useDawn();
  const { mode, setMode } = useAppTheme();
  const isHub = layout === 'hub';
  const styles = React.useMemo(() => makeStyles(Dawn, isHub), [Dawn, isHub]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, isHub && styles.hubSectionTitle]}>
        {isHub ? '🌤️ Atmosphere' : 'Appearance'}
      </Text>
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

function makeStyles(Dawn: ReturnType<typeof useDawn>, isHub: boolean) {
  return StyleSheet.create({
    wrap: {
      paddingVertical: isHub ? 2 : 4,
      alignSelf: 'stretch',
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      color: Dawn.text.secondary,
      opacity: 0.85,
      marginBottom: 8,
      letterSpacing: 0.2,
    },
    hubSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: Dawn.text.primary,
      opacity: 0.9,
      marginBottom: 6,
      letterSpacing: 0,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: isHub ? 12 : 8,
      alignSelf: isHub ? 'center' : 'stretch',
      maxWidth: isHub ? 272 : undefined,
    },
    segment: {
      flex: isHub ? 0 : 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: isHub ? 9 : 10,
      paddingHorizontal: isHub ? 10 : 8,
      minWidth: isHub ? 118 : undefined,
      maxWidth: isHub ? 130 : undefined,
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
