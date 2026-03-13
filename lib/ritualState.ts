/**
 * Shared ritual state for load (welcome) and witness (sunrise) screens.
 * Ensures subheading and CTA continuity across the flow.
 */

export type RitualStateType = 'blank' | 'new' | 'returning';

export interface RitualState {
  subheading: string;
  cta: string;
  state: RitualStateType;
}

export function getRitualState(
  user: { id: string } | null,
  streak: number
): RitualState {
  if (!user) {
    return {
      subheading: 'See the day differently.',
      cta: 'Begin today',
      state: 'blank',
    };
  }
  if (streak === 0) {
    return {
      subheading: 'A quiet place to begin.',
      cta: 'Start the ritual',
      state: 'new',
    };
  }
  return {
    subheading: 'Make space for the first light.',
    cta: 'Step outside',
    state: 'returning',
  };
}

/**
 * Subheading for the witness (sunrise) screen only.
 * Never returns "See the day differently." — that is load-only.
 * When totalSunrises === 1 (first ever log), use past tense.
 */
export function getWitnessSubheading(streak: number, totalSunrises?: number): string {
  if (streak < 1) return 'A quiet place to begin.';
  if (totalSunrises === 1) return 'You made space for the first light.';
  return 'Make space for the first light.';
}
