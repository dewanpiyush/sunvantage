# Sunrise card — time-based visuals

How the **Sunrise today** card (`SunriseStateCard`) looks through the day. Copy/logic still uses **pre / live / post**; visuals use four **atmosphere** phases.

**Primary files**

| Area | Path |
|------|------|
| Atmosphere tokens + helpers | `lib/sunriseCardAtmosphere.ts` |
| Card component + inner gradients | `components/SunriseStateCard.tsx` |
| Today tab | `app/(tabs)/today.tsx` |
| Witness screen glow | `app/sunrise.tsx` |
| Morning timing | `hooks/useMorningContext.ts` |

---

## Two layers of “phase”

| Layer | Values | Used for |
|-------|--------|----------|
| **sunrisePhase** | `pre` · `live` · `post` | Copy, CTAs, layout on Today (`getSunrisePhase`) |
| **cardAtmosphere** | `pre` · `live` · `morning` · `retrospective` | Card surface, borders, inner gradients, witness glow |

`post` (copy) spans both **morning** and **retrospective** (visual).

---

## Atmosphere rules (`getSunriseCardAtmosphere`)

Uses `minutesToSunrise` in the user’s city and **city-local hour**:

| Atmosphere | When |
|------------|------|
| **pre** | More than 20 min before sunrise |
| **live** | 20 min before → 20 min after sunrise |
| **morning** | After live window, city hour **&lt; 9** |
| **retrospective** | City hour **≥ 9** (or fallback when timing missing and hour ≥ 9) |

Constant: `RETROSPECTIVE_CITY_HOUR = 9` in `lib/sunriseCardAtmosphere.ts`.

---

## Visual treatment per atmosphere

### Pre-dawn (`pre`)

- **Emotion:** quiet anticipation; not warm yet.
- **Surface (dark):** `rgba(10, 24, 48, 0.94)`
- **Border:** cool moonlit `rgba(140, 180, 255, 0.35)`
- **Inner gradient:** none
- **Sun emoji shadow:** cool blue

### Live window (`live`) — hero

- **Emotion:** “this is the moment.”
- **Inner gradient** (3-stop, top → bottom):
  - `rgba(255, 210, 120, 0.02)`
  - `rgba(255, 170, 80, 0.08)`
  - `rgba(255, 150, 60, 0.16)`
- **Border (dark):** `rgba(255, 195, 110, 0.72)`
- **Witness glow:** **0.42** in ±20 min window after sunrise; **0.22** in same window before sunrise; **0.06** before window when still pre-sunrise

### Morning (`morning`)

- **Emotion:** day begun; fresh, airy — not orange.
- **Inner gradient** (blue-sky wash):
  - `rgba(72, 124, 186, 0.05)` → `0.18`
- **Border:** soft gold-blue `rgba(220, 205, 140, 0.45)` (dark)
- **Surface tint:** deeper blue-gray base under gradient

### Retrospective (`retrospective`)

- **Emotion:** settled, reflective.
- **Treatment:** default `Dawn.surface.card` + standard border (no phase gradient)
- **Witness glow:** stepped down after live window (0.35 → 0.2 → 0.07 by hours since sunrise)

### After logging (any atmosphere)

- Additional **post-log** amber overlay (unchanged):
  - `rgba(255, 179, 71, 0.0)` → `0.11`
- Stacks on top of live/morning phase gradients when applicable.

---

## Architecture (unchanged shape)

1. **Wrapper** — `getSunriseCardSurfaceStyle(atmosphere, isMorningLight)` passed as `style` on `SunriseStateCard` (Today + Witness).
2. **Inner overlays** — `LinearGradient` in `SunriseStateCard` keyed by `atmosphere` + `hasLoggedToday`.
3. **tone** — `context` for `live` and `morning`; `default` for `pre` and `retrospective`.
4. **Witness glow** — separate `Animated.View` behind card; `getWitnessSunriseGlowIntensity()`.

No continuous interpolation, no new card component, no heavy animation.

---

## Light mode (`morning-light`)

Same atmosphere keys; surfaces/borders use lighter tints in `getSunriseCardSurfaceStyle` (e.g. pre: cool blue-gray fill, live: warm cream base).

---

## What does not change with atmosphere

- App theme toggle (user preference)
- Full-screen background gradients on Today/Witness
- Copy/CTA `sunrisePhase` thresholds
- Vantage walk card (no atmosphere wiring yet — neutral default)

---

## Logging window

Same-day log modal blocked until ≤ 25 min before sunrise (`lib/sunriseLoggingWindow.ts`). Independent of card atmosphere.

---

*Last updated: four-phase atmosphere system (`lib/sunriseCardAtmosphere.ts`).*
