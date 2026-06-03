import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import SunVantageHeader from '@/components/SunVantageHeader';
import AppearanceModeToggle from '@/components/AppearanceModeToggle';
import { useAppTheme } from '@/context/AppThemeContext';
import { useDawn } from '@/hooks/use-dawn';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';

export type NavHubItem = {
  emoji: string;
  title: string;
  subtitle: string;
  route: string;
};

type Props = {
  title: string;
  subtitle?: string;
  items: NavHubItem[];
  secondaryItems?: NavHubItem[];
  /** Morning Light / Night Calm toggle below main items (You tab). */
  showAppearanceToggle?: boolean;
  signOutLabel?: string;
  onSignOut?: () => void;
};

export default function NavHubScreen({
  title,
  subtitle,
  items,
  secondaryItems = [],
  showAppearanceToggle = false,
  signOutLabel,
  onSignOut,
}: Props) {
  const router = useRouter();
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const showUtilityFooter = showAppearanceToggle || secondaryItems.length > 0 || (signOutLabel && onSignOut);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={
          isMorningLight
            ? (['#EAF3FB', '#DCEAF7', '#CFE2F3'] as const)
            : (['#102A43', '#1B3554', '#243F63'] as const)
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <SunVantageHeader title={title} subtitle={subtitle} hideMenu showBranding screenTitle />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <Pressable
            key={item.route}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(item.route as never)}
          >
            <Text style={styles.cardEmoji}>{item.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </Pressable>
        ))}

        {showUtilityFooter ? (
          <View style={styles.utilityFooter}>
            {showAppearanceToggle || secondaryItems.length > 0 ? (
              <View style={styles.hubSectionDivider} />
            ) : null}

            {showAppearanceToggle ? <AppearanceModeToggle /> : null}

            {secondaryItems.map((item) => (
              <Pressable
                key={item.route}
                style={({ pressed }) => [styles.secondaryCard, pressed && styles.cardPressed]}
                onPress={() => router.push(item.route as never)}
              >
                <Text style={styles.secondaryEmoji}>{item.emoji}</Text>
                <View style={styles.cardText}>
                  <Text style={styles.secondaryTitle}>{item.title}</Text>
                  <Text style={styles.secondarySubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={styles.cardChevron}>›</Text>
              </Pressable>
            ))}

            {signOutLabel && onSignOut ? (
              <>
                {showAppearanceToggle || secondaryItems.length > 0 ? (
                  <View style={styles.utilityDivider} />
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.signOutWrap, pressed && styles.signOutPressed]}
                  onPress={onSignOut}
                  accessibilityRole="button"
                  accessibilityLabel={signOutLabel}
                >
                  <Text style={styles.signOutText}>{signOutLabel}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
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
    backgroundGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    header: {
      paddingHorizontal: 24,
      marginBottom: 8,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: TAB_BAR_CLEARANCE + 8,
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor: Dawn.surface.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Dawn.border.subtle,
    },
    cardPressed: {
      opacity: 0.9,
    },
    cardEmoji: {
      fontSize: 22,
      marginRight: 14,
    },
    cardText: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Dawn.text.primary,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: Dawn.text.secondary,
    },
    cardChevron: {
      fontSize: 22,
      color: Dawn.text.secondary,
      opacity: 0.45,
      marginLeft: 8,
    },
    utilityFooter: {
      marginTop: 14,
      gap: 10,
    },
    hubSectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255, 220, 180, 0.14)',
      marginBottom: 2,
    },
    utilityDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255, 220, 180, 0.12)',
      marginVertical: 2,
    },
    secondaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: 'rgba(22, 38, 62, 0.72)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 200, 120, 0.10)',
    },
    secondaryEmoji: {
      fontSize: 17,
      marginRight: 12,
      opacity: 0.8,
    },
    secondaryTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: Dawn.text.primary,
      marginBottom: 2,
      opacity: 0.92,
    },
    secondarySubtitle: {
      fontSize: 12,
      lineHeight: 16,
      color: Dawn.text.secondary,
      opacity: 0.78,
    },
    signOutWrap: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutPressed: {
      opacity: 0.78,
    },
    signOutText: {
      fontSize: 13,
      fontWeight: '500',
      color: Dawn.text.secondary,
      opacity: 0.82,
      letterSpacing: 0.25,
    },
  });
}
