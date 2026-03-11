/**
 * Single reflection prompt for sunrise logging and memory card.
 * Keeps the experience consistent: one daily prompt for reflection.
 */

export const REFLECTION_PROMPT = 'What stayed with you today?';

/** Always returns the same reflection prompt. */
export async function getNextReflectionPrompt(): Promise<string> {
  return REFLECTION_PROMPT;
}

/** No-op; kept for API compatibility when saving a log. */
export async function setLastUsedReflectionPrompt(_prompt: string): Promise<void> {
  // Single prompt: nothing to persist.
}
