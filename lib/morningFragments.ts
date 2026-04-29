import type { MorningFragmentIllustrationType } from '@/components/MorningFragmentCard';

export type MorningFragment = {
  id: string;
  title: string;
  body: string;
  illustrationType: MorningFragmentIllustrationType;
};

export const CURATED_MORNING_FRAGMENT_COUNT = 7;

/**
 * Morning Fragments product guardrails:
 * - This section is a quiet, optional archive layer; it is NOT a feed.
 * - Keep the collection finite and chronological (oldest -> newest).
 * - Render a fixed curated set (first 7 items) for now.
 * - Do not add feed mechanics (likes, comments, shares, read-more, notifications, infinite scroll).
 * - Avoid engagement-oriented UI; preserve a calm, non-intrusive reading experience.
 */

export const MORNING_FRAGMENTS: MorningFragment[] = [
  {
    id: 'mf-01',
    title: 'PYRAMID ALIGNMENTS · EGYPT',
    body: 'Some Egyptian temples are aligned with solar events.\nSunrise played a role in religious architecture.',
    illustrationType: 'pyramidEgypt',
  },
  {
    id: 'mf-02',
    title: 'Temple Doors',
    body: 'Some ancient temple entrances were oriented so first light entered directly at dawn rituals.',
    illustrationType: 'gateIndia',
  },
  {
    id: 'mf-03',
    title: 'Bird Dawn Chorus',
    body: 'Many bird species begin coordinated singing shortly before sunrise, a signal linked to light change.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-04',
    title: 'Blue Hour',
    body: 'Before sunrise, sunlight scattered in the atmosphere gives the sky a deep blue cast.',
    illustrationType: 'blueHour',
  },
  {
    id: 'mf-05',
    title: 'Solar Navigation',
    body: 'Historical wayfinders used the sunrise position as a directional reference during open-water travel.',
    illustrationType: 'solarNavigation',
  },
  {
    id: 'mf-06',
    title: 'Shadow Clocks',
    body: 'Early timekeeping systems tracked changing dawn shadows to estimate morning progression.',
    illustrationType: 'shadowClocks',
  },
  {
    id: 'mf-07',
    title: 'High Latitude Dawn',
    body: 'Near polar regions, sunrise can linger close to the horizon, stretching twilight for hours.',
    illustrationType: 'highLatitudeDawn',
  },
  {
    id: 'mf-08',
    title: 'Morning Air',
    body: 'Cooler dawn temperatures often increase air density, making distant features appear unusually clear.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-09',
    title: 'Prayer Timing',
    body: 'In many traditions, dawn marks a distinct prayer window tied to first visible light.',
    illustrationType: 'gateIndia',
  },
  {
    id: 'mf-10',
    title: 'Crop Rhythms',
    body: 'Farm work in many regions historically began at sunrise to match temperature and daylight cycles.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-11',
    title: 'Sun Pillars',
    body: 'In cold conditions, ice crystals can produce vertical light columns near sunrise.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-12',
    title: 'Equinox Lines',
    body: 'Certain structures align with sunrise near equinox, when day and night are nearly equal.',
    illustrationType: 'pyramidEgypt',
  },
  {
    id: 'mf-13',
    title: 'First Light Paint',
    body: 'Artists and surveyors have long favored dawn for soft contrast and directional light.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-14',
    title: 'Call to Work',
    body: 'In many port and market towns, public activity once began with sunrise bells or calls.',
    illustrationType: 'gateIndia',
  },
  {
    id: 'mf-15',
    title: 'Alpine Dawn',
    body: 'Mountain peaks can catch sunlight minutes before valleys, creating staged sunrise bands.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-16',
    title: 'Seasonal Shift',
    body: 'Sunrise times move through the year due to Earth tilt and orbital geometry.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-17',
    title: 'Fisher Departures',
    body: 'Coastal fishing schedules in many regions have historically followed sunrise windows.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-18',
    title: 'Desert Mornings',
    body: 'Desert communities often use dawn for travel, avoiding stronger heat later in the day.',
    illustrationType: 'pyramidEgypt',
  },
  {
    id: 'mf-19',
    title: 'Ceremonial East',
    body: 'East-facing orientation appears repeatedly in ceremonial architecture across continents.',
    illustrationType: 'gateIndia',
  },
  {
    id: 'mf-20',
    title: 'Sky Color Order',
    body: 'Reds and oranges near sunrise appear as shorter wavelengths scatter out first along long paths.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-21',
    title: 'Fog Reveal',
    body: 'Low-angle dawn light can outline terrain and water edges as fog begins to lift.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-22',
    title: 'Monastery Schedules',
    body: 'Historical monastic routines in multiple regions marked first observances near dawn.',
    illustrationType: 'gateIndia',
  },
  {
    id: 'mf-23',
    title: 'Urban Sunrise Gap',
    body: 'Building height and street orientation can delay direct sunrise at ground level.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-24',
    title: 'Calendar Anchor',
    body: 'Sunrise observations have been used as practical anchors for seasonal calendars.',
    illustrationType: 'sunpathJapan',
  },
  {
    id: 'mf-25',
    title: 'Harbor Dawn Lines',
    body: 'Some historic ports were laid out so sunrise light marked channels and working hours.',
    illustrationType: 'sunpathJapan',
  },
];

export async function getUnlockedMorningFragments(): Promise<MorningFragment[]> {
  const capped = Math.min(CURATED_MORNING_FRAGMENT_COUNT, MORNING_FRAGMENTS.length);
  return MORNING_FRAGMENTS.slice(0, capped);
}

