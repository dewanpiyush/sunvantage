# Global Sunrise Map — design notes

Poetic MVP visualization: **sunrise moving across humanity** — not GIS-precise.

## Visual model

| Element | Meaning |
|---------|---------|
| Darker wash | Morning still ahead |
| Soft warm/blue reveal | Sunrise has passed here today |
| Single glowing curve | Sunrise now |
| Gold dots | Morning welcomed today |

## Files

| Piece | Path |
|--------|------|
| Screen | `screens/GlobalSunriseMapScreen.tsx` |
| Overlay | `components/map/SunriseTerminator.tsx` |
| Terminator math | `lib/sunTerminator.ts` |
| Projection | `lib/mapProjection.ts` |

## Render stack (bottom → top)

1. Ocean `#081425`
2. `SunriseAtmosphere` — night hemisphere + soft dawn gradient (below land)
3. `WorldMap` land only `#556B8E`
4. `SunriseFrontier` — single glow curve
5. Witness dots + quiet legend

No dual frontiers, awaiting bands, or latitude strips.

## Tuning

`SunriseTerminator.tsx`: `NIGHT_HEMISPHERE_FILL`, `dayReveal` gradient stops, frontier glow opacities.

`WorldMap.tsx`: `MAP_OCEAN_COLOR`, `MAP_LAND_COLOR`.

`lib/sunTerminator.ts`: `getSubsolarPoint`, `getTerminatorGeometry` precision.

---

*Last updated: simplified poetic terminator model.*
