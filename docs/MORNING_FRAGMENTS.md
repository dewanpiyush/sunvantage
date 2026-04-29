# Morning Fragments

A quiet, optional archive layer surfaced on the Morning Fragments screen. Each card
contains a short observation from culture, science, or history around sunrise.

## Product guardrails

- **Finite & chronological** — the collection is ordered oldest → newest and does
  not grow indefinitely.
- **One unlock per local day** — at most one new fragment becomes visible per
  calendar day in the user's local timezone.
- **Not a feed** — no likes, comments, shares, read-more, notifications, or
  infinite scroll. No engagement-oriented UI.
- **Cap of 30 visible cards** (`MAX_RENDERABLE_FRAGMENTS`), even if more are
  authored in `MORNING_FRAGMENTS`.

Source of truth: [`lib/morningFragments.ts`](../lib/morningFragments.ts).
Rendering: [`components/MorningFragmentCard.tsx`](../components/MorningFragmentCard.tsx).

---

## Illustration motifs

Each card is paired with one of six minimal, geometric illustrations. All share
the same dark-navy sky / flat ground language and sand/saffron/mist accents.

| `illustrationType` | Motif name | What it depicts |
|---|---|---|
| `pyramidEgypt` | **Pyramid** | Two silhouetted pyramids on a ground plane; a faint alignment line runs from the hero apex to a small sun resting exactly on its peak with a soft intersection glow. Sand accent. |
| `gateIndia` | **Temple Doors** | Three nested door frames (far → mid → near) receding into the scene; a narrow sunbeam and floor glow pass through them from a small sun just above the horizon. Saffron accent. |
| `sunpathJapan` | **Dawn Chorus** | Horizon-separated sky and ground with a faint first-light band; a small dim sun near the horizon; six tiny bird-arcs distributed across the sky; two subtle sound-wave hairlines. Mist accent. |
| `blueHour` | **Blue Hour** | Deep-to-cool blue vertical gradient sky with five faint stars; a pale pre-sunrise glow along the horizon, soft atmospheric haze, and a minimal distant land/water silhouette. No sun disk. Mist accent. |
| `solarNavigation` | **Solar Navigation** | Open horizon (sea/flat-land feel); a small golden sun clearly above the horizon; a faint vertical hairline projecting the sun's position down to the horizon; a single thin diagonal path rising from the lower-left foreground and converging at that same horizon point. Sand accent. |
| `shadowClocks` | **Shadow Clocks** | Primitive dawn timekeeping composition: a center gnomon on a semi-circular dial arc, an elongated angled morning shadow, a low near-horizon sun, and faint progression ticks. Sand accent. |

---

## Full card list

All 25 authored fragments, in unlock order.

### mf-01 — Pyramid Alignments · Egypt
- **Illustration:** `pyramidEgypt` (Pyramid)
- **Body:**
  > Some Egyptian temples are aligned with solar events.
  > Sunrise played a role in religious architecture.

### mf-02 — Temple Doors
- **Illustration:** `gateIndia` (Temple Doors)
- **Body:**
  > Some ancient temple entrances were oriented so first light entered directly at dawn rituals.

### mf-03 — Bird Dawn Chorus
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Many bird species begin coordinated singing shortly before sunrise, a signal linked to light change.

### mf-04 — Blue Hour
- **Illustration:** `blueHour` (Blue Hour)
- **Body:**
  > Before sunrise, sunlight scattered in the atmosphere gives the sky a deep blue cast.

### mf-05 — Solar Navigation
- **Illustration:** `solarNavigation` (Solar Navigation)
- **Body:**
  > Historical wayfinders used the sunrise position as a directional reference during open-water travel.

### mf-06 — Shadow Clocks
- **Illustration:** `shadowClocks` (Shadow Clocks)
- **Body:**
  > Early timekeeping systems tracked changing dawn shadows to estimate morning progression.

### mf-07 — High Latitude Dawn
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Near polar regions, sunrise can linger close to the horizon, stretching twilight for hours.

### mf-08 — Morning Air
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Cooler dawn temperatures often increase air density, making distant features appear unusually clear.

### mf-09 — Prayer Timing
- **Illustration:** `gateIndia` (Temple Doors)
- **Body:**
  > In many traditions, dawn marks a distinct prayer window tied to first visible light.

### mf-10 — Crop Rhythms
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Farm work in many regions historically began at sunrise to match temperature and daylight cycles.

### mf-11 — Sun Pillars
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > In cold conditions, ice crystals can produce vertical light columns near sunrise.

### mf-12 — Equinox Lines
- **Illustration:** `pyramidEgypt` (Pyramid)
- **Body:**
  > Certain structures align with sunrise near equinox, when day and night are nearly equal.

### mf-13 — First Light Paint
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Artists and surveyors have long favored dawn for soft contrast and directional light.

### mf-14 — Call to Work
- **Illustration:** `gateIndia` (Temple Doors)
- **Body:**
  > In many port and market towns, public activity once began with sunrise bells or calls.

### mf-15 — Alpine Dawn
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Mountain peaks can catch sunlight minutes before valleys, creating staged sunrise bands.

### mf-16 — Seasonal Shift
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Sunrise times move through the year due to Earth tilt and orbital geometry.

### mf-17 — Fisher Departures
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Coastal fishing schedules in many regions have historically followed sunrise windows.

### mf-18 — Desert Mornings
- **Illustration:** `pyramidEgypt` (Pyramid)
- **Body:**
  > Desert communities often use dawn for travel, avoiding stronger heat later in the day.

### mf-19 — Ceremonial East
- **Illustration:** `gateIndia` (Temple Doors)
- **Body:**
  > East-facing orientation appears repeatedly in ceremonial architecture across continents.

### mf-20 — Sky Color Order
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Reds and oranges near sunrise appear as shorter wavelengths scatter out first along long paths.

### mf-21 — Fog Reveal
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Low-angle dawn light can outline terrain and water edges as fog begins to lift.

### mf-22 — Monastery Schedules
- **Illustration:** `gateIndia` (Temple Doors)
- **Body:**
  > Historical monastic routines in multiple regions marked first observances near dawn.

### mf-23 — Urban Sunrise Gap
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Building height and street orientation can delay direct sunrise at ground level.

### mf-24 — Calendar Anchor
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Sunrise observations have been used as practical anchors for seasonal calendars.

### mf-25 — Harbor Dawn Lines
- **Illustration:** `sunpathJapan` (Dawn Chorus)
- **Body:**
  > Some historic ports were laid out so sunrise light marked channels and working hours.

---

## Illustration distribution

| Motif | Count | Fragments |
|---|---|---|
| `sunpathJapan` (Dawn Chorus) | 14 | 03, 07, 08, 10, 11, 13, 15, 16, 17, 20, 21, 23, 24, 25 |
| `gateIndia` (Temple Doors) | 5 | 02, 09, 14, 19, 22 |
| `pyramidEgypt` (Pyramid) | 3 | 01, 12, 18 |
| `blueHour` (Blue Hour) | 1 | 04 |
| `solarNavigation` (Solar Navigation) | 1 | 05 |
| `shadowClocks` (Shadow Clocks) | 1 | 06 |

> The Dawn Chorus motif is currently carrying most of the science / phenomenon
> cards. Consider authoring more dedicated illustrations (e.g. a "sun pillars"
> column motif, a "fog" motif, a "seasonal arc" motif) if visual variety becomes
> a concern as more fragments are added.
