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
 */
export function getWitnessSubheading(streak: number): string {
  return streak >= 1 ? 'Make space for the first light.' : 'A quiet place to begin.';
}
