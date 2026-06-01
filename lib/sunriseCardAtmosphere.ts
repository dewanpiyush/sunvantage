import type { ViewStyle } from 'react-native';

/** City-local hour (0–23) when the card shifts from “morning” to settled retrospective. */
export const RETROSPECTIVE_CITY_HOUR = 9;

export function getCityHourInTimezone(timezone: string | null | undefined): number | null {
  if (!timezone?.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '', 10);
    return Number.isNaN(hour) ? null : hour;
  } catch {
    return null;
  }
}

export type SunriseCardAtmosphere = 'pre' | 'live' | 'morning' | 'retrospective';

/** Visual atmosphere for the sunrise card (finer than copy `pre` / `live` / `post`). */
export function getSunriseCardAtmosphere(
  minutesToSunrise: number | null | undefined,
  cityHour: number | null | undefined
): SunriseCardAtmosphere {
  if (minutesToSunrise != null) {
    if (minutesToSunrise > 20) return 'pre';
    if (minutesToSunrise >= -20) return 'live';
    if (cityHour != null && cityHour >= RETROSPECTIVE_CITY_HOUR) return 'retrospective';
    return 'morning';
  }
  if (cityHour != null && cityHour >= RETROSPECTIVE_CITY_HOUR) return 'retrospective';
  if (cityHour != null && cityHour < RETROSPECTIVE_CITY_HOUR) return 'morning';
  return 'pre';
}

/** Inner gradient overlays (reuses post-log overlay pattern in SunriseStateCard). */
export const SUNRISE_CARD_GRADIENTS = {
  live: {
    colors: ['rgba(255, 210, 120, 0.02)', 'rgba(255, 170, 80, 0.08)', 'rgba(255, 150, 60, 0.16)'] as const,
    locations: [0, 0.48, 1] as const,
  },
  morning: {
    colors: ['rgba(72, 124, 186, 0.05)', 'rgba(72, 124, 186, 0.10)', 'rgba(72, 124, 186, 0.18)'] as const,
    locations: [0, 0.5, 1] as const,
  },
  postLog: {
    colors: ['rgba(255, 179, 71, 0.0)', 'rgba(255, 179, 71, 0.11)'] as const,
    locations: [0, 1] as const,
  },
} as const;

/** Wrapper surface + border per atmosphere (Today / Witness pass via `style`). */
export function getSunriseCardSurfaceStyle(
  atmosphere: SunriseCardAtmosphere,
  isMorningLight: boolean
): ViewStyle {
  switch (atmosphere) {
    case 'pre':
      return isMorningLight
        ? {
            backgroundColor: 'rgba(214, 226, 244, 0.92)',
            borderColor: 'rgba(120, 158, 220, 0.42)',
            borderWidth: 1.15,
          }
        : {
            backgroundColor: 'rgba(10, 24, 48, 0.94)',
            borderColor: 'rgba(140, 180, 255, 0.35)',
            borderWidth: 1.15,
          };
    case 'live':
      return isMorningLight
        ? {
            backgroundColor: 'rgba(252, 242, 228, 0.88)',
            borderColor: 'rgba(255, 195, 110, 0.58)',
            borderWidth: 1.2,
          }
        : {
            backgroundColor: 'rgba(28, 36, 56, 0.88)',
            borderColor: 'rgba(255, 195, 110, 0.72)',
            borderWidth: 1.2,
          };
    case 'morning':
      return isMorningLight
        ? {
            backgroundColor: 'rgba(232, 242, 252, 0.90)',
            borderColor: 'rgba(200, 188, 130, 0.50)',
            borderWidth: 1,
          }
        : {
            backgroundColor: 'rgba(22, 38, 62, 0.86)',
            borderColor: 'rgba(220, 205, 140, 0.45)',
            borderWidth: 1,
          };
    case 'retrospective':
    default:
      return {};
  }
}

/** Witness elliptical glow behind the card. */
export function getWitnessSunriseGlowIntensity(
  minutesToSunrise: number | null | undefined,
  hoursSinceSunrise: number
): number {
  const inLiveWindow =
    minutesToSunrise != null && minutesToSunrise >= -20 && minutesToSunrise <= 20;
  if (minutesToSunrise != null && minutesToSunrise >= 0) {
    return inLiveWindow ? 0.22 : 0.06;
  }
  if (inLiveWindow) return 0.42;
  if (hoursSinceSunrise <= 2) return 0.35;
  if (hoursSinceSunrise <= 6) return 0.2;
  return 0.07;
}
