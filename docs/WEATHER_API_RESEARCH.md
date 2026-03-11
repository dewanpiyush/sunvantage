# Morning Awareness — API Research

Research for a lightweight weather and sunrise data source to power **morning awareness** (pre-sunrise messaging, explorer nudges, tomorrow planning). Goal: sunrise today, sunrise tomorrow, weather tomorrow, simple condition (clear / cloudy / rain).

---

## 1. Candidate APIs

### OpenWeather API

| Aspect | Notes |
|--------|--------|
| **Sunrise/sunset** | One Call API 3.0 includes sunrise/sunset; 2.5 deprecated June 2024. |
| **Weather** | Daily/hourly forecast, weather conditions. |
| **Auth** | Free tier: sign up for API key (email only). 1,000 calls/day (One Call 3.0). |
| **Rate limits** | 60 calls/min; recommended ≤1 call per 10 min per location. |
| **Location** | Coordinates (lat/lng); no built-in city search — need separate Geocoding API. |

**Pros:** Well documented, single vendor for weather + (with geo) city.  
**Cons:** API key required, two endpoints (geo + one-call), rate limits to watch.

---

### WeatherAPI.com

| Aspect | Notes |
|--------|--------|
| **Sunrise/sunset** | Available in Astronomy and Forecast APIs. |
| **Weather** | Current + forecast, condition codes. |
| **Auth** | Free tier with API key; limited calls/month. |
| **Location** | Supports city name in request (e.g. `q=London`). |

**Pros:** City-by-name, one vendor.  
**Cons:** API key, usage limits on free tier, less widely referenced than OpenWeather/Open-Meteo for “no key” use cases.

---

### Sunrise-Sunset.org

| Aspect | Notes |
|--------|--------|
| **Sunrise/sunset** | Dedicated API: sunrise, sunset, solar noon, twilights. |
| **Weather** | None. |
| **Auth** | **No API key.** Free. |
| **Request** | `GET https://api.sunrise-sunset.org/json?lat=...&lng=...&date=YYYY-MM-DD` (optional `date`, `tzid` for timezone). |
| **Limits** | “Reasonable request volume”; attribution required (link to site). |

**Pros:** No signup, no key, simple, fast. Ideal for sun-only.  
**Cons:** Lat/lng only (no city search); no weather. If used alone, must combine with another API for weather and/or geocoding.

---

### Open-Meteo

| Aspect | Notes |
|--------|--------|
| **Sunrise/sunset** | In **daily** forecast: `sunrise`, `sunset` (ISO8601) per day. |
| **Weather** | Daily/hourly forecast; **weather_code** (WMO) for simple classification. |
| **Auth** | **No API key** for non-commercial use. |
| **Geocoding** | Separate **Geocoding API**: `https://geocoding-api.open-meteo.com/v1/search?name=CityName` → lat, lng, timezone. |
| **Forecast** | `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&daily=sunrise,sunset,weather_code&timezone=...` |
| **Limits** | No key = generous for mobile; commercial use requires plan. |

**Pros:** Free, no key, one ecosystem (geocoding + forecast), fast, mobile-friendly. Single forecast call gives sunrise today, sunrise tomorrow, and tomorrow’s weather code.  
**Cons:** Two calls per “session” (geocode once, then forecast); city → coordinates via separate endpoint.

---

## 2. Preferred Choice

**Primary: Open-Meteo only**

- **Geocoding:** `geocoding-api.open-meteo.com/v1/search?name={city}` → first result’s `latitude`, `longitude`, `timezone`.
- **Forecast:** `api.open-meteo.com/v1/forecast` with `daily=sunrise,sunset,weather_code` and `timezone=auto` (or from geocode).  
  From the **daily** arrays we get:
  - **Sunrise today** → `daily.sunrise[0]`
  - **Sunrise tomorrow** → `daily.sunrise[1]`
  - **Weather tomorrow** → `daily.weather_code[1]` → map to clear/cloudy/rain/storm.

No second weather/sun API is required. If we ever need to swap (e.g. stricter uptime), a fallback could be:

- **Sunrise-Sunset.org** (sun only, lat/lng)  
- **Open-Meteo** (weather only, or full forecast)

---

## 3. Summary Table

| API | Sunrise | Weather | City support | Auth | Best for |
|-----|---------|---------|--------------|------|----------|
| OpenWeather | Yes (One Call 3.0) | Yes | Via Geo API | API key | Full-featured, key OK |
| WeatherAPI.com | Yes | Yes | By name | API key | Single vendor, city by name |
| Sunrise-Sunset.org | Yes | No | No (lat/lng) | None | Sun-only, minimal |
| **Open-Meteo** | **Yes (daily)** | **Yes (WMO code)** | **Geocoding API** | **None (non-commercial)** | **Morning awareness (chosen)** |

---

## 4. Implementation Notes

- **User location:** Use `user.city` from profile (e.g. `profiles.city`). Coordinates can be persisted on the profile so geocoding runs only once per user (see `getCoordinatesForCity` and `getMorningContext(..., options)` with `userId` + `supabase`).
- **Profile columns for coordinates:** To persist lat/lng/timezone, ensure `profiles` has `latitude` (float), `longitude` (float), `timezone` (text). Updates use `.eq('user_id', userId)`.
- **Cache:** Key `sunvantage_weather_{date}_{normalizedCity}` in AsyncStorage; `normalizedCity` = `city.trim().toLowerCase()` to avoid duplicate cache for "Delhi" / "delhi" / "Delhi ". Refresh once per day.
- **Condition mapping:** Open-Meteo WMO codes → `clear` | `cloudy` | `rain` | `storm` | `unknown` (see `classifyMorningWeather` in `services/weatherService.ts`).
- **Derived flags:** `sunrisePassed = minutesToSunrise < 0`; `earlyMorning = minutesToSunrise > 30`.
