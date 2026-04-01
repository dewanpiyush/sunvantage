# Global Sunrise Map — debugging & design notes

This document helps you reason about why the map can feel **underwhelming** or **misaligned with intuition**, and where to tune or refactor without spelunking the whole repo.

## 1. Entry points & files

| Piece | Path |
|--------|------|
| Route | `app/global-sunrise-map.tsx` → `screens/GlobalSunriseMapScreen.tsx` |
| Map base (land/water SVG) | `components/map/WorldMap.tsx` |
| Terminator + night shading overlay | `components/map/SunriseTerminator.tsx` |
| Witness dots | `components/map/CityDot.tsx`, `components/map/UserCityDot.tsx` |
| Stats strip | `components/GlobalSunriseStats.tsx` |
| Today’s aggregates | `lib/fetchGlobalSunriseLogs.ts` |

**Geometry source:** `lib/sunTerminator.ts` — `getSubsolarPoint`, `getTerminatorGeometry`, `getNightHemisphereGeometry` (night disk = great circle centered on antipode of subsolar, radius 90°). Projection: `lib/mapProjection.ts` (Mercator, same as `WorldMap`).

There is **no** separate `sunriseProgressShading.ts` file; shading lives entirely in `SunriseTerminator.tsx`.

## 2. Render stack (bottom → top)

On `GlobalSunriseMapScreen`, inside the map container:

1. **`WorldMap`** — world geometry; palette is independent of terminator.
2. **`Animated.View`** wrapping **`SunriseTerminator`** — applies `arcOpacity` + `translateX` drift/pulse only to the overlay (not to dots).
3. **`CityDot`** (per city with logs today).
4. **`UserCityDot`** (profile city).
5. **Vignette `LinearGradient`s** — darken top/bottom edges; they can **flatten** perceived contrast if too strong.
6. **“Sunrise now” label** — decorative legend.

When debugging “I see no terminator”, first question: **is the overlay clipped or invisible**, or are vignettes + world colors dominating?

## 3. What the shading model is (terminator-based)

`SunriseTerminator` uses **real solar geometry** for the day/night split:

- **`getSubsolarPoint(date)`** → `[subsolarLng, subsolarLat]` (see `lib/sunTerminator.ts` for NOAA-style approximations).
- **Night hemisphere** = same spherical disk as the terminator boundary: `geoCircle().center(antipode(subsolar)).radius(90°)` — implemented as **`getNightHemisphereGeometry(date)`** (precision 0.5 for smooth fill).
- **Terminator polyline** = **`getTerminatorGeometry(date)`** (same circle, used for stroke path).
- Paths are projected with **`getMapProjection(width, height)`** + **`getGeoPath`** so they align with `WorldMap`.

**Implications:**

- The boundary is a **curve** on the map (Mercator), not a vertical screen strip.
- “Day” vs “night” here is **astronomical** (sun above vs below horizon), not “local sunrise time of day” semantics. User expectations about “my morning” may still differ from “this side is lit by the sun.”

## 4. How the overlay is painted (order matters)

Inside `SunriseTerminator`’s SVG:

1. **Full-map** `Rect` with `rgba(244, 201, 93, 0.06)` — soft warm base (“day” side feel).
2. **`Path`** night hemisphere fill `rgba(0, 0, 0, 0.32)` — dimmed night side.
3. **Clipped** terminator **stroke** (outer glow → mid glow → core) along the **curved** terminator path.

There are **no** vertical bands, `sunriseX`, or longitude-curtain rectangles.

**Why it can still look flat:**

- Base and night opacities are intentionally moderate; **vignettes** on the screen add another global dim.
- `now` updates every **10 minutes**; the terminator moves slowly between refreshes.

## 5. Time updates on the map screen

- `now` is updated on an interval: **`REFRESH_INTERVAL_MS`** (10 minutes) in `GlobalSunriseMapScreen.tsx`, and the same tick **`loadData()`** refetches aggregates.
- **Subsolar math uses UTC seconds** inside `getSubsolarPoint` (see `sunTerminator.ts`).

**Debug idea:** Temporarily set `REFRESH_INTERVAL_MS` to `60_000` or add a `setInterval` **only for `setNow`** every 30–60s to animate the terminator without hammering Supabase.

## 6. Animation layer

- `arcDrift`: `translateX` between about `-8` and `+8` px.
- `arcOpacity`: interpolates between `~0.62` and `~0.75` (current tuning).

The animation **does not** change solar math; it only **wiggles** the overlay slightly.

## 7. Quick verification checklist

1. **Log `getSubsolarPoint(date)`** in `__DEV__` and compare to known references (e.g. subsolar near equator at equinoxes around 12 UTC).
2. **Screenshot with vignettes disabled** — if contrast improves a lot, tune vignette alpha first.
3. **Temporarily increase** `NIGHT_HEMISPHERE_FILL` or `DAY_BASE_FILL` to see if the split is obvious; then tune back for calm.
4. **Mercator limits**: extreme latitudes distort the terminator appearance; that’s projection behavior, not a bug in the geo circle.

## 8. Constants worth A/B tuning

In `components/map/SunriseTerminator.tsx`:

| Constant | Role |
|----------|------|
| `DAY_BASE_FILL` | Warm wash over full map |
| `NIGHT_HEMISPHERE_FILL` | Night-side dimming |
| `OUTER_*` / `MID_*` / `CORE_*` | Terminator glow line strength |

In `lib/sunTerminator.ts`:

| Area | Role |
|------|------|
| `getSubsolarPoint` | Solar position — drives both terminator and night disk |
| `getNightHemisphereGeometry` `.precision(0.5)` | Smoothness of night fill |

In `GlobalSunriseMapScreen.tsx`: vignette gradient alphas.

## 9. Why results can still feel “underwhelming”

- **Semantic mismatch**: “Terminator” = astronomical day/night, not “people who logged sunrise” or “local dawn.”
- **Subtle palette**: intentional calm → low contrast on some devices.
- **Stacked dims**: night fill + map + vignettes.
- **Slow `now` refresh**: terminator appears static between refreshes.

## 10. Possible follow-ups (not required for debugging)

- Separate **visual** `now` tick (every minute) from **data** refresh.
- Softer night fill (e.g. navy tint instead of black) for “calm.”
- Optional label: “Sunlit / night” vs “Sunrise now” if copy should match astronomy.

## 11. Related code

- **`lib/sunTerminator.ts`** — subsolar point, terminator, night hemisphere GeoJSON.
- **`lib/mapProjection.ts`** — must stay in sync with `WorldMap` width/height.
- **`CityDot` / `UserCityDot`** — same projection inputs; separate from shading.

---

*Last updated: terminator-based shading in `SunriseTerminator.tsx` + `lib/sunTerminator.ts`.*
