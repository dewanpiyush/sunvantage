/** Earliest moment same-day logging may open: this many minutes before today's sunrise. */
export const SUNRISE_LOGGING_EARLIEST_MINUTES = 25;

/** True from midnight until fewer than 25 minutes remain before sunrise (e.g. before 4:50 for 5:15). */
export function isBeforeSunriseLoggingOpens(minutesToSunrise: number | null | undefined): boolean {
  return minutesToSunrise != null && minutesToSunrise > SUNRISE_LOGGING_EARLIEST_MINUTES;
}
