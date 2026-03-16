/**
 * Fetches global sunrise stats and city dots via RPC so aggregation bypasses RLS.
 * Stats: get_global_sunrise_stats() returns total_witnesses, city_count, country_count.
 * Cities: get_global_sunrise_cities() returns aggregated dots for the map.
 * userWitnessedToday: one small RLS-allowed query (current user's logs only).
 */

import supabase from '@/supabase';

const MAX_CITIES = 200;

export type CityLogAggregate = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  logs: number;
};

export type GlobalSunriseAggregate = {
  cities: CityLogAggregate[];
  totalWitnesses: number;
  cityCount: number;
  countryCount: number;
  userWitnessedToday: boolean;
};

/** Viewer's local date YYYY-MM-DD for sunrise_day aggregation. */
function getTodayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Fetches global stats via get_global_sunrise_stats RPC (SECURITY DEFINER),
 * city dots via get_global_sunrise_cities RPC, and whether the current user
 * logged today via sunrise_day = viewer's local date.
 */
export async function fetchGlobalSunriseLogs(
  currentUserId: string | null
): Promise<GlobalSunriseAggregate> {
  const displayDate = getTodayLocalDateString();

  const [statsRes, citiesRes, userLogRes] = await Promise.all([
    supabase.rpc('get_global_sunrise_stats', { display_date: displayDate }),
    supabase.rpc('get_global_sunrise_cities', {
      max_cities: MAX_CITIES,
      display_date: displayDate,
    }),
    currentUserId
      ? supabase
          .from('sunrise_logs')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('sunrise_day', displayDate)
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (statsRes.error) {
    console.warn('[SunVantage] get_global_sunrise_stats:', statsRes.error.message);
    return {
      cities: [],
      totalWitnesses: 0,
      cityCount: 0,
      countryCount: 0,
      userWitnessedToday: false,
    };
  }

  const row = (statsRes.data && statsRes.data[0]) as
    | { total_witnesses: number; city_count: number; country_count: number }
    | undefined;
  const totalWitnesses = row?.total_witnesses ?? 0;
  const cityCount = row?.city_count ?? 0;
  const countryCount = row?.country_count ?? 0;

  const cities: CityLogAggregate[] = [];
  if (!citiesRes.error && Array.isArray(citiesRes.data)) {
    for (const r of citiesRes.data as Array<{
      city: string | null;
      country: string | null;
      lat: number | null;
      lng: number | null;
      logs: number;
    }>) {
      const city = (r.city && r.city.trim()) || '';
      const lat = r.lat;
      const lng = r.lng;
      if (!city || lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) continue;
      cities.push({
        city,
        country: (r.country && r.country.trim()) || '',
        lat,
        lng,
        logs: Number(r.logs) || 0,
      });
    }
  } else if (citiesRes.error) {
    console.warn('[SunVantage] get_global_sunrise_cities:', citiesRes.error.message);
  }

  const userWitnessedToday =
    currentUserId != null &&
    Array.isArray(userLogRes.data) &&
    userLogRes.data.length > 0;

  return {
    cities,
    totalWitnesses,
    cityCount,
    countryCount,
    userWitnessedToday,
  };
}
