/** Canonical app routes — use for navigation to preserve tab + deep-link compatibility. */
export const ROUTES = {
  today: '/(tabs)/today',
  tomorrow: '/(tabs)/tomorrow',
  community: '/(tabs)/community',
  you: '/(tabs)/you',
  /** Alias for Today tab (legacy `/home` redirects here). */
  home: '/(tabs)/today',
  auth: '/auth',
  onboarding: '/onboarding',
  witness: '/witness',
  sunrise: '/sunrise',
  myMornings: '/my-mornings',
  profile: '/profile',
  ritualMarkers: '/ritual-markers',
  globalMap: '/global-sunrise-map',
  worldGallery: '/world-sunrise-gallery',
  cityGallery: '/my-city-sunrises',
  morningFragments: '/morning-fragments',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
