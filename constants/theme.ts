/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * Dawn palette: warmer UI used across main app screens.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export type AppAppearanceMode = 'morning-light' | 'night-calm';

/** Night Calm (existing) — warmer "dawn" UI used across main app screens. */
export const NightCalm = {
  background: {
    primary: '#0E223D',
  },
  surface: {
    card: '#162F52',
    cardSecondary: '#122845',
    cardPrimary: '#1a3558',
  },
  /** Subtle sections / secondary surface. In Night Calm we reuse card surface. */
  surfaceSecondary: {
    subtle: '#122845',
  },
  accent: {
    sunrise: '#FFB347',
    sunriseOn: '#0E223D',
  },
  border: {
    subtle: '#2A466B',
    soft: '#2A466B',
    sunriseCard: 'rgba(255,179,71,0.55)',
  },
  text: {
    primary: '#E7EEF7',
    secondary: '#AFC2DA',
  },
} as const;

/** Morning Light — soft sky-inspired light mode. */
export const MorningLight = {
  background: {
    /** Do NOT use pure white for full screen backgrounds. */
    primary: '#EAF3FB',
  },
  surface: {
    card: '#FFFFFF',
    cardSecondary: '#DCEAF7',
    cardPrimary: '#FFFFFF',
  },
  surfaceSecondary: {
    /** Subtle sections. */
    subtle: '#DCEAF7',
  },
  accent: {
    /** CTA unchanged. */
    sunrise: '#F5A623',
    /** Text/icon on CTA. */
    sunriseOn: '#1F2A37',
  },
  border: {
    subtle: '#E3EAF2',
    soft: '#E3EAF2',
    /** Keep sunrise emphasis without heavy contrast. */
    sunriseCard: 'rgba(245,166,35,0.40)',
  },
  text: {
    primary: '#1F2A37',
    secondary: '#6B7280',
  },
} as const;

/** Back-compat: many screens import `Dawn` as the Night Calm palette today. */
export const Dawn = NightCalm;

export type DawnPalette = typeof NightCalm;

export function getDawnPalette(mode: AppAppearanceMode): DawnPalette {
  return mode === 'morning-light' ? (MorningLight as unknown as DawnPalette) : NightCalm;
}

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

