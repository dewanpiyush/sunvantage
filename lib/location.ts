/**
 * Optional location detection: permission, current position, reverse geocoding.
 * Uses expo-location for position and Nominatim (OpenStreetMap) for reverse geocode
 * so behavior is consistent across iOS and Android.
 */

import * as Location from 'expo-location';

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

export type Coords = { latitude: number; longitude: number };

/** Request foreground location permission. Returns true if granted. */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Get current position. Returns null if permission denied or location unavailable. */
export async function getCurrentPosition(): Promise<Coords | null> {
  const granted = await requestLocationPermission();
  if (!granted) return null;
  try {
    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
    };
  } catch {
    return null;
  }
}

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  suburb?: string;
  neighbourhood?: string;
  county?: string;
  display_name?: string;
};

/** Reverse geocode to a city name (for onboarding). Prefers city > town > village > state. */
export async function reverseGeocodeToCity(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'SunVantage/1.0' },
    });
    const data = await res.json();
    const addr: NominatimAddress = data?.address ?? {};
    const name =
      addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.state ?? addr.county ?? null;
    return name ? String(name).trim() : null;
  } catch {
    return null;
  }
}

/** Reverse geocode to a short place name (for vantage / "where were you"). */
export async function reverseGeocodeToPlaceName(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'SunVantage/1.0' },
    });
    const data = await res.json();
    const addr: NominatimAddress = data?.address ?? {};
    const name =
      addr.suburb ??
      addr.neighbourhood ??
      addr.village ??
      addr.town ??
      addr.city ??
      addr.municipality ??
      null;
    return name ? String(name).trim() : null;
  } catch {
    return null;
  }
}
