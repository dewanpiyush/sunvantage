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
const SUNRISE_CITY_CACHE_KEY_PREFIX = 'sunvantage_sunrise_city_';
const DEFAULT_FALLBACK_SUNRISE_HHMM = '06:00';

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'unknown';

export type MorningContext = {
  sunriseToday: string;
  sunriseTomorrow: string;
  minutesToSunrise: number;
  sunrisePassed: boolean;
  earlyMorning: boolean;
  tomorrowWeather: WeatherCondition;
  condition: 'good_for_exploring' | 'ok_for_exploring' | 'poor_for_exploring' | 'unknown';
  sunriseSource: 'live' | 'cached' | 'fallback';
  cityTimezone: string;
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
type CachedCitySunrise = {
  city: string;
  sunriseTime: string;
  timezone: string;
  date: string;
  cachedAt: string;
};

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

function citySunriseCacheKey(city: string): string {
  const normalizedCity = normalizedCityForCache(city);
  return `${SUNRISE_CITY_CACHE_KEY_PREFIX}${normalizedCity}`;
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
  const localMatch = isoOrDate.match(/T(\d{1,2}):(\d{2})/);
  if (localMatch) {
    const h = parseInt(localMatch[1], 10);
    const m = parseInt(localMatch[2], 10);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getNowPartsInTimeZone(timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((p) => p.type === type)?.value ?? '0';
    return parseInt(value, 10);
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function getMinutesToSunriseInTimezone(sunriseLocal: string, timezone: string): number {
  const local = sunriseLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})/);
  if (!local) return 0;
  const [, y, m, d, h, min] = local;
  const sunriseYear = parseInt(y, 10);
  const sunriseMonth = parseInt(m, 10);
  const sunriseDay = parseInt(d, 10);
  const sunriseHour = parseInt(h, 10);
  const sunriseMinute = parseInt(min, 10);
  if ([sunriseYear, sunriseMonth, sunriseDay, sunriseHour, sunriseMinute].some(Number.isNaN)) return 0;

  const now = getNowPartsInTimeZone(timezone);
  const dayDiff = Math.round(
    (Date.UTC(sunriseYear, sunriseMonth - 1, sunriseDay) - Date.UTC(now.year, now.month - 1, now.day)) / 86_400_000
  );
  return dayDiff * 1440 + (sunriseHour * 60 + sunriseMinute) - (now.hour * 60 + now.minute);
}

function getMinutesToSunriseFromHHmmInTimezone(sunriseHHmm: string, timezone: string): number {
  const hhmm = sunriseHHmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!hhmm) return 0;
  const sunriseHour = parseInt(hhmm[1], 10);
  const sunriseMinute = parseInt(hhmm[2], 10);
  if (Number.isNaN(sunriseHour) || Number.isNaN(sunriseMinute)) return 0;
  const now = getNowPartsInTimeZone(timezone);
  return (sunriseHour * 60 + sunriseMinute) - (now.hour * 60 + now.minute);
}

/**
 * Minutes until sunrise using the selected city's local clock when possible.
 * `sunriseTime` from morning context is HH:mm in that city — **not** device local time.
 * Falls back to {@link getMinutesToSunrise} when timezone or format is missing.
 */
export function getMinutesToSunriseForCity(
  sunriseTime: string | null | undefined,
  cityTimezone: string | null | undefined
): number | null {
  if (!sunriseTime?.trim()) return null;
  const s = sunriseTime.trim();
  const tz = cityTimezone?.trim();
  if (tz) {
    const match = s.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        const norm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const mins = getMinutesToSunriseFromHHmmInTimezone(norm, tz);
        return Number.isFinite(mins) ? mins : null;
      }
    }
  }
  const legacy = getMinutesToSunrise(s);
  return Number.isFinite(legacy) ? legacy : null;
}

function normalizeHHmmOrFallback(value: string | null | undefined): string {
  if (!value) return DEFAULT_FALLBACK_SUNRISE_HHMM;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return DEFAULT_FALLBACK_SUNRISE_HHMM;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return DEFAULT_FALLBACK_SUNRISE_HHMM;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function readCachedCitySunrise(city: string): Promise<{ sunriseTime: string; timezone: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(citySunriseCacheKey(city));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCitySunrise;
    const time = normalizeHHmmOrFallback(parsed?.sunriseTime);
    const timezone = typeof parsed?.timezone === 'string' && parsed.timezone.trim() ? parsed.timezone.trim() : 'UTC';
    return { sunriseTime: time, timezone };
  } catch {
    return null;
  }
}

async function writeCachedCitySunrise(city: string, sunriseTime: string, timezone: string): Promise<void> {
  try {
    const payload: CachedCitySunrise = {
      city: city.trim(),
      sunriseTime: normalizeHHmmOrFallback(sunriseTime),
      timezone: timezone.trim() || 'UTC',
      date: getTodayDateKey(),
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(citySunriseCacheKey(city), JSON.stringify(payload));
  } catch {
    // ignore cache write errors
  }
}

function buildFallbackContext(
  sunriseToday: string,
  sunriseTomorrow: string,
  source: 'cached' | 'fallback',
  cityTimezone: string
): MorningContext {
  const today = normalizeHHmmOrFallback(sunriseToday);
  const tomorrow = normalizeHHmmOrFallback(sunriseTomorrow);
  const timezone = cityTimezone?.trim() || 'UTC';
  const minutesToSunrise = getMinutesToSunriseFromHHmmInTimezone(today, timezone);
  const sunrisePassed = minutesToSunrise < 0;
  return {
    sunriseToday: today,
    sunriseTomorrow: tomorrow,
    minutesToSunrise,
    sunrisePassed,
    earlyMorning: minutesToSunrise > 30,
    tomorrowWeather: 'unknown',
    condition: 'unknown',
    sunriseSource: source,
    cityTimezone: timezone,
  };
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
        let cityTimezone = typeof parsed.cityTimezone === 'string' && parsed.cityTimezone.trim()
          ? parsed.cityTimezone.trim()
          : null;
        // Backward-compatible recovery for old cache entries that predate cityTimezone.
        if (!cityTimezone) {
          const geoFromCacheRecovery = await getCoordinatesForCity(trimmed, options);
          cityTimezone = geoFromCacheRecovery?.timezone?.trim() || null;
        }
        if (!cityTimezone) {
          const citySunrise = await readCachedCitySunrise(trimmed);
          cityTimezone = citySunrise?.timezone ?? null;
        }
        if (!cityTimezone) cityTimezone = 'UTC';
        const minutesToSunrise = getMinutesToSunriseFromHHmmInTimezone(parsed.sunriseToday, cityTimezone);
        const sunrisePassed = minutesToSunrise < 0;
        const earlyMorning = minutesToSunrise > 30;
        const cachedContextResolved: MorningContext = {
          ...parsed,
          minutesToSunrise,
          sunrisePassed,
          earlyMorning,
          sunriseSource: parsed.sunriseSource ?? 'cached',
          cityTimezone,
        };
        // Persist upgraded cache shape so future reads are stable.
        try {
          const toCache: CachedContext = { ...cachedContextResolved, cachedAt: new Date().toISOString() };
          await AsyncStorage.setItem(key, JSON.stringify(toCache));
        } catch {
          // ignore cache write errors
        }
        return cachedContextResolved;
      }
    }
  } catch {
    // ignore cache read errors
  }

  // 2. Coordinates (from profile if available, else geocode and optionally persist)
  const geo = await getCoordinatesForCity(trimmed, options);
  if (!geo) {
    const cachedCitySunrise = await readCachedCitySunrise(trimmed);
    if (cachedCitySunrise) {
      return buildFallbackContext(cachedCitySunrise.sunriseTime, cachedCitySunrise.sunriseTime, 'cached', cachedCitySunrise.timezone);
    }
    return buildFallbackContext(DEFAULT_FALLBACK_SUNRISE_HHMM, DEFAULT_FALLBACK_SUNRISE_HHMM, 'fallback', 'UTC');
  }

  // 3. Forecast
  const daily = await fetchForecast(geo.latitude, geo.longitude, geo.timezone);
  if (!daily?.time?.length || !daily.sunrise?.length || daily.weather_code == null) {
    const cachedCitySunrise = await readCachedCitySunrise(trimmed);
    if (cachedCitySunrise) {
      return buildFallbackContext(cachedCitySunrise.sunriseTime, cachedCitySunrise.sunriseTime, 'cached', cachedCitySunrise.timezone);
    }
    return buildFallbackContext(DEFAULT_FALLBACK_SUNRISE_HHMM, DEFAULT_FALLBACK_SUNRISE_HHMM, 'fallback', geo.timezone);
  }

  const sunriseTodayRaw = daily.sunrise[0];
  const sunriseTomorrowRaw = daily.sunrise[1];
  const weatherCodeTomorrow = daily.weather_code[1] ?? daily.weather_code[0];

  const sunriseToday = formatTimeToHHmm(sunriseTodayRaw);
  const sunriseTomorrow = formatTimeToHHmm(sunriseTomorrowRaw);
  const tomorrowWeather = classifyMorningWeather({ weather_code: weatherCodeTomorrow });
  const minutesToSunrise = getMinutesToSunriseInTimezone(sunriseTodayRaw, geo.timezone);
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
    sunriseSource: 'live',
    cityTimezone: geo.timezone,
  };

  // 4. Cache
  try {
    const toCache: CachedContext = { ...context, cachedAt: new Date().toISOString() };
    await AsyncStorage.setItem(key, JSON.stringify(toCache));
  } catch {
    // ignore cache write errors
  }
  await writeCachedCitySunrise(trimmed, sunriseToday, geo.timezone);

  return context;
}
