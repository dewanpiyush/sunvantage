/**
 * Morning Awareness — Weather & Sunrise Service
 *
 * Uses Open-Meteo (geocoding + forecast). No API key required for non-commercial use.
 * Data is cached per day per city to avoid repeated calls.
 * Coordinates can be persisted on the profile (latitude, longitude, timezone) so geocoding runs once per user.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';

const CACHE_KEY_PREFIX = 'sunvantage_weather_';

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'unknown';

export type MorningContext = {
  sunriseToday: string;
  sunriseTomorrow: string;
  minutesToSunrise: number;
  sunrisePassed: boolean;
  earlyMorning: boolean;
  tomorrowWeather: WeatherCondition;
  condition: 'good_for_exploring' | 'ok_for_exploring' | 'poor_for_exploring' | 'unknown';
};

export type GetMorningContextOptions = {
  userId: string;
  supabase: SupabaseClient;
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  timezone: string;
};

type OpenMeteoDaily = {
  time: string[];
  sunrise: string[];
  sunset: string[];
  weather_code: number[];
};

type CachedContext = MorningContext & { cachedAt: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get YYYY-MM-DD for today (local date) for cache key. */
function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Normalize city for cache key: lowercase, trim. Avoids duplicate cache for "Delhi" / "delhi" / "Delhi ". */
function normalizedCityForCache(city: string): string {
  return city.trim().toLowerCase() || 'unknown';
}

function cacheKey(city: string): string {
  const normalizedCity = normalizedCityForCache(city);
  const date = getTodayDateKey();
  return `${CACHE_KEY_PREFIX}${date}_${normalizedCity}`;
}

/**
 * Classify Open-Meteo WMO weather code into simple morning condition.
 * Mapping: clear sky → clear; few clouds → clear; scattered/overcast → cloudy;
 * rain/drizzle → rain; thunderstorm → storm.
 */
export function classifyMorningWeather(weatherData: { weather_code?: number }): WeatherCondition {
  const code = weatherData?.weather_code;
  if (code == null || typeof code !== 'number') return 'unknown';

  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return code === 1 ? 'clear' : 'cloudy'; // 1 = mainly clear, 2/3 = partly/overcast
  if ([45, 48].includes(code)) return 'cloudy'; // fog
  if (code >= 51 && code <= 67) return 'rain';  // drizzle, freezing drizzle, rain
  if (code >= 71 && code <= 77) return 'cloudy'; // snow (treat as cloudy for “exploring”)
  if (code >= 80 && code <= 82) return 'rain';   // rain showers
  if (code >= 85 && code <= 86) return 'cloudy'; // snow showers
  if (code >= 95 && code <= 99) return 'storm';  // thunderstorm
  return 'unknown';
}

/**
 * Minutes from now until the given sunrise time.
 * sunriseTime: ISO8601 string (e.g. "2026-03-05T06:24") or "HH:mm" or "H:mm AM/PM".
 * Returns negative if sunrise is in the past today.
 */
export function getMinutesToSunrise(sunriseTime: string): number {
  let date = new Date(sunriseTime);
  if (Number.isNaN(date.getTime())) {
    // Try "HH:mm" or "H:mm AM/PM" — use today
    const today = new Date();
    const match = sunriseTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = (match[3] || '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0, 0);
    } else {
      return 0;
    }
  }
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.round(diffMs / 60_000);
}

/** Format ISO8601 or date to "HH:mm" (local). */
function formatTimeToHHmm(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Derive exploration condition from weather. */
function conditionFromWeather(weather: WeatherCondition): MorningContext['condition'] {
  switch (weather) {
    case 'clear':
      return 'good_for_exploring';
    case 'cloudy':
      return 'ok_for_exploring';
    case 'rain':
    case 'storm':
      return 'poor_for_exploring';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

async function geocodeCity(city: string): Promise<GeocodeResult | null> {
  const name = encodeURIComponent(city.trim());
  if (!name || name.length < 2) return null;
  const url = `${GEOCODE_BASE}?name=${name}&count=1&format=json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const first = data?.results?.[0];
    if (first?.latitude == null || first?.longitude == null) return null;
    return {
      latitude: first.latitude,
      longitude: first.longitude,
      timezone: first.timezone || 'auto',
    };
  } catch {
    return null;
  }
}

/**
 * Resolve coordinates for a city. If options (userId + supabase) are provided:
 * - If the profile already has latitude, longitude, and timezone, use them (no geocoding).
 * - Otherwise call Open-Meteo geocoding, then update the profile with the result.
 * If options are not provided, just geocode and return (no persistence).
 * Profile table should have columns: latitude, longitude, timezone (and user_id for the update).
 */
export async function getCoordinatesForCity(
  city: string,
  options?: { userId: string; supabase: SupabaseClient }
): Promise<GeocodeResult | null> {
  const trimmed = city?.trim();
  if (!trimmed) return null;

  if (options?.userId && options?.supabase) {
    const { data: profile } = await options.supabase
      .from('profiles')
      .select('latitude, longitude, timezone')
      .eq('user_id', options.userId)
      .maybeSingle();

    const lat = profile?.latitude;
    const lng = profile?.longitude;
    const tz = profile?.timezone;
    if (typeof lat === 'number' && typeof lng === 'number' && tz != null && String(tz).trim() !== '') {
      return { latitude: lat, longitude: lng, timezone: String(tz).trim() };
    }

    const geo = await geocodeCity(trimmed);
    if (!geo) return null;

    await options.supabase
      .from('profiles')
      .update({
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
      })
      .eq('user_id', options.userId);

    return geo;
  }

  return geocodeCity(trimmed);
}

// ---------------------------------------------------------------------------
// Forecast (Open-Meteo)
// ---------------------------------------------------------------------------

async function fetchForecast(lat: number, lng: number, timezone: string): Promise<OpenMeteoDaily | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone,
    daily: 'sunrise,sunset,weather_code',
    forecast_days: '2',
  });
  const url = `${FORECAST_BASE}?${params.toString()}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data?.daily) return data.daily as OpenMeteoDaily;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sunrise time today (HH:mm) for the given city.
 * Requires geocoding + forecast; consider using getMorningContext for a single fetch.
 */
export async function getSunriseToday(city: string): Promise<string | null> {
  const ctx = await getMorningContext(city);
  return ctx?.sunriseToday ?? null;
}

/**
 * Sunrise time tomorrow (HH:mm) for the given city.
 */
export async function getSunriseTomorrow(city: string): Promise<string | null> {
  const ctx = await getMorningContext(city);
  return ctx?.sunriseTomorrow ?? null;
}

/**
 * Tomorrow's weather as a simple condition (clear / cloudy / rain / storm / unknown).
 */
export async function getTomorrowWeather(city: string): Promise<WeatherCondition | null> {
  const ctx = await getMorningContext(city);
  return ctx?.tomorrowWeather ?? null;
}

/**
 * Full morning context: sunrise today/tomorrow, minutes to sunrise, sunrisePassed, earlyMorning, tomorrow weather, exploration condition.
 * Uses cache key: sunvantage_weather_{date}_{normalizedCity}. Refresh once per day.
 * Pass options (userId + supabase) to use persisted coordinates and avoid geocoding on every request.
 */
export async function getMorningContext(
  city: string,
  options?: GetMorningContextOptions
): Promise<MorningContext | null> {
  const trimmed = city?.trim();
  if (!trimmed) return null;

  const key = cacheKey(trimmed);

  // 1. Try cache
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed: CachedContext = JSON.parse(raw);
      if (parsed?.sunriseToday != null) {
        const minutesToSunrise = getMinutesToSunrise(parsed.sunriseToday);
        const sunrisePassed = minutesToSunrise < 0;
        const earlyMorning = minutesToSunrise > 30;
        return {
          ...parsed,
          minutesToSunrise,
          sunrisePassed,
          earlyMorning,
        };
      }
    }
  } catch {
    // ignore cache read errors
  }

  // 2. Coordinates (from profile if available, else geocode and optionally persist)
  const geo = await getCoordinatesForCity(trimmed, options);
  if (!geo) return null;

  // 3. Forecast
  const daily = await fetchForecast(geo.latitude, geo.longitude, geo.timezone);
  if (!daily?.time?.length || !daily.sunrise?.length || daily.weather_code == null) return null;

  const sunriseTodayRaw = daily.sunrise[0];
  const sunriseTomorrowRaw = daily.sunrise[1];
  const weatherCodeTomorrow = daily.weather_code[1] ?? daily.weather_code[0];

  const sunriseToday = formatTimeToHHmm(sunriseTodayRaw);
  const sunriseTomorrow = formatTimeToHHmm(sunriseTomorrowRaw);
  const tomorrowWeather = classifyMorningWeather({ weather_code: weatherCodeTomorrow });
  const minutesToSunrise = getMinutesToSunrise(sunriseTodayRaw);
  const sunrisePassed = minutesToSunrise < 0;
  const earlyMorning = minutesToSunrise > 30;
  const condition = conditionFromWeather(tomorrowWeather);

  const context: MorningContext = {
    sunriseToday,
    sunriseTomorrow,
    minutesToSunrise,
    sunrisePassed,
    earlyMorning,
    tomorrowWeather,
    condition,
  };

  // 4. Cache
  try {
    const toCache: CachedContext = { ...context, cachedAt: new Date().toISOString() };
    await AsyncStorage.setItem(key, JSON.stringify(toCache));
  } catch {
    // ignore cache write errors
  }

  return context;
}
