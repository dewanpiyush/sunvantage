import React from 'react';
import { View, Text, Pressable, StyleSheet, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useDawn } from '@/hooks/use-dawn';
import { ROUTES } from '@/lib/routes';

const SPACE = 8;
const TITLE_TO_TAGLINE = 6;
const TAGLINE_TO_ARROW = 6;
/** Space below chevron before next screen content (pairs with home scroll padding). */
const ARROW_BOTTOM = SPACE;
const ARROW_TO_CONTENT = 18;

type Props = {
  showBack?: boolean;
  title?: string;
  subtitle?: string;
  /** Optional tagline shown below the SunVantage title (e.g. on home). Tappable with title to open nav. */
  tagline?: string;
  children?: React.ReactNode;
  /** When true, first menu item is "Today's sunrise"; when false, "Log today's sunrise". Both route to /witness. */
  hasLoggedToday?: boolean;
  /** When true, show "My Mornings" in the nav panel. If omitted, we infer it from profile data. */
  hasEverLogged?: boolean;
  /** When true, only show back (← Home), title, subtitle; no SunVantage dropdown. */
  hideMenu?: boolean;
  /** When true with hideMenu, show the large "SunVantage" branding text (no menu trigger). */
  showBranding?: boolean;
  /** When true, show "My City's Sunrises" in the nav panel. */
  showMyCitySunrises?: boolean;
  /** Override bottom margin of the header wrapper (e.g. 0 for tighter layout when scroll content has its own padding). */
  wrapperMarginBottom?: number;
  /** Override back button label (e.g. "Back" when returning to previous screen instead of Home). */
  backLabel?: string;
  /** Override back button action (e.g. router.back() when returning to previous screen). */
  onBackPress?: () => void;
  /** When true, title uses slightly larger screen-title style (for top-level pages). */
  screenTitle?: boolean;
  /** When set, header tap runs this (e.g. go home). When unset, header tap opens the nav drawer (Home only). */
  onHeaderPress?: () => void;
  /** Hide the sunrise emoji next to “SunVantage” (e.g. My Mornings keeps 🌅 only in body copy). */
  hideHeaderEmoji?: boolean;
  /** One-time behavior: show nav immediately on mount (no trigger tap). */
  openNavOnMount?: boolean;
  /** Subtle nudge: blink chevron indicator briefly (used for discovery, not auto-open). */
  highlightChevronHint?: boolean;
  /** Called when user manually opens the nav from header tap. */
  onNavOpen?: () => void;
  /** Optional override for subtitle text (e.g. opacity, lineHeight). */
  subtitleStyle?: TextStyle;
};

export default function SunVantageHeader({
  showBack,
  title,
  subtitle,
  tagline,
  children,
  hideMenu = true,
  showBranding = false,
  wrapperMarginBottom,
  backLabel,
  onBackPress,
  screenTitle = false,
  onHeaderPress,
  hideHeaderEmoji = false,
  subtitleStyle,
}: Props) {
  const router = useRouter();
  const Dawn = useDawn();

  const handleHeaderPress = () => {
    onHeaderPress?.();
  };

  const handleBackPress = onBackPress ?? (() => { router.push(ROUTES.today as never); });
  const isBackWithBrandingRow = Boolean(showBack && hideMenu && showBranding);
  const displayBackLabel = backLabel ?? (isBackWithBrandingRow ? '‹' : hideMenu ? '← Home' : '‹ SunVantage Home');

  const wrapperStyle = wrapperMarginBottom !== undefined ? [styles.wrapper, { marginBottom: wrapperMarginBottom }] : styles.wrapper;

  return (
    <>
      <View style={wrapperStyle}>
        {isBackWithBrandingRow ? (
          <Pressable
            style={({ pressed }) => [styles.backBrandingRow, pressed && { opacity: 0.78 }]}
            onPress={handleBackPress}
          >
            <Text style={[styles.backControlText, styles.backBrandingSpacer, { color: Dawn.text.secondary }]}>
              {displayBackLabel}
            </Text>
            <Text style={[styles.appName, { color: Dawn.text.primary }]}>SunVantage</Text>
            {!hideHeaderEmoji ? (
              <Text style={styles.headerEmoji}>{'\u{1F305}'}</Text>
            ) : null}
          </Pressable>
        ) : (
          <>
            {showBack && (
              <Pressable
                style={({ pressed }) => [styles.backControl, pressed && { opacity: 0.72 }]}
                onPress={handleBackPress}
              >
                <Text style={[styles.backControlText, { color: Dawn.text.secondary }]}>{displayBackLabel}</Text>
              </Pressable>
            )}
            {!hideMenu ? (
              <Pressable
                style={({ pressed }) => [styles.headerBlock, pressed && { opacity: 0.78 }]}
                onPress={handleHeaderPress}
              >
                <View style={styles.headerRow}>
                  <Text style={[styles.appName, { color: Dawn.text.primary }]}>SunVantage</Text>
                  {!hideHeaderEmoji ? (
                    <Text style={styles.headerEmoji}>{'\u{1F305}'}</Text>
                  ) : null}
                </View>
                {tagline ? (
                  <Text style={[styles.tagline, { color: Dawn.text.secondary, opacity: 0.75 }]}>{tagline}</Text>
                ) : null}
              </Pressable>
            ) : null}
            {hideMenu && showBranding && !showBack ? (
              <>
                <View style={styles.headerRow}>
                  <Text style={[styles.appName, { color: Dawn.text.primary }]}>SunVantage</Text>
                  {!hideHeaderEmoji ? (
                    <Text style={styles.headerEmoji}>{'\u{1F305}'}</Text>
                  ) : null}
                </View>
                {tagline ? (
                  <Text style={[styles.tagline, { color: Dawn.text.secondary, opacity: 0.75 }]}>{tagline}</Text>
                ) : null}
              </>
            ) : null}
          </>
        )}
        {title ? (
          <Text
            style={[
              styles.title,
              screenTitle && styles.screenTitle,
              isBackWithBrandingRow && styles.titleCompact,
              { color: Dawn.text.primary },
            ]}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              isBackWithBrandingRow && styles.subtitleCompact,
              { color: Dawn.text.secondary },
              subtitleStyle,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>

    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: ARROW_TO_CONTENT,
  },
  backBrandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingVertical: 8,
    paddingRight: 16,
    alignSelf: 'flex-start',
  },
  backBrandingSpacer: {
    marginRight: 8,
  },
  backControl: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backControlText: {
    fontSize: 14,
    // color set dynamically in component
  },
  headerBlock: {
    alignSelf: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    fontSize: 20,
    // color set dynamically in component
    marginRight: 4,
    fontWeight: '300',
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    // color set dynamically in component
    letterSpacing: 0.8,
  },
  headerEmoji: {
    fontSize: 20,
    marginLeft: 6,
  },
  tagline: {
    marginTop: TITLE_TO_TAGLINE,
    fontSize: 14,
    // color set dynamically in component
  },
  arrowIndicator: {
    marginTop: TAGLINE_TO_ARROW,
    marginBottom: ARROW_BOTTOM,
    fontSize: 14,
    // color set dynamically in component
    opacity: 0.8,
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '600',
    // color set dynamically in component
    letterSpacing: 0.8,
  },
  screenTitle: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '700',
  },
  titleCompact: {
    marginTop: 4,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    // color set dynamically in component
  },
  subtitleCompact: {
    marginTop: 4,
  },
});
