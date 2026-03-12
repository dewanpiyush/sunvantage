/**
 * Vantage naming, normalization, and display helpers.
 * Used for storage (user_input_vantage, normalized_vantage, vantage_category),
 * full-screen overlay (public vs private), and stats (e.g. "Most mornings from").
 */

const FILLER_WORDS = new Set(['my', 'today', 'this', 'the']);

/** Synonyms map raw token → canonical normalized form. */
const SYNONYMS: Record<string, string> = {
  roof: 'terrace',
  rooftop: 'terrace',
  house: 'home',
};

/** Canonical private vantages (normalized form). roof is stored as terrace. */
const PRIVATE_NORMALIZED = new Set(['home', 'balcony', 'terrace', 'window', 'yard']);

export type VantageCategory = 'private' | 'public';

export type NormalizedVantageResult = {
  /** Trimmed user input (for display and user_input_vantage). */
  userInputVantage: string;
  /** Canonical form for grouping and stats, or null if empty. */
  normalizedVantage: string | null;
  /** private = home-like, public = park, lake, beach, etc. */
  vantageCategory: VantageCategory;
};

/**
 * Normalize user-entered vantage for storage and stats.
 * - lowercase
 * - remove filler words: my, today, this, the
 * - map synonyms: roof → terrace, rooftop → terrace, house → home
 * - private: home, balcony, terrace, roof, window, yard (roof/rooftop become terrace)
 * - public: anything else
 */
export function normalizeVantageForStorage(userInput: string): NormalizedVantageResult {
  const trimmed = (userInput ?? '').trim();
  if (trimmed === '') {
    return { userInputVantage: '', normalizedVantage: null, vantageCategory: 'private' };
  }

  const lower = trimmed.toLowerCase();
  const tokens = lower.split(/\s+/).filter((t) => t.length > 0);
  const withoutFillers = tokens.filter((t) => !FILLER_WORDS.has(t));
  const withSynonyms = withoutFillers.map((t) => SYNONYMS[t] ?? t);
  const normalized = withSynonyms.join(' ').trim();
  if (normalized === '') {
    return { userInputVantage: trimmed, normalizedVantage: null, vantageCategory: 'private' };
  }

  const category: VantageCategory = PRIVATE_NORMALIZED.has(normalized) ? 'private' : 'public';
  return {
    userInputVantage: trimmed,
    normalizedVantage: normalized,
    vantageCategory: category,
  };
}

/** True if vantage is private (home-like). Uses normalized form or raw name. */
export function isPrivateVantage(
  vantageName: string | null | undefined,
  vantageCategory?: VantageCategory | null
): boolean {
  if (vantageCategory === 'private') return true;
  if (vantageCategory === 'public') return false;
  if (vantageName == null || vantageName.trim() === '') return true;
  const { vantageCategory: derived } = normalizeVantageForStorage(vantageName);
  return derived === 'private';
}

/** Format date for overlay: "Feb 6". */
export function formatOverlayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Title-case for display. */
export function toTitleCaseVantage(text: string): string {
  if (!text) return text;
  return text
    .split(' ')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Lines for full-screen image overlay and gallery.
 * - Public: line1 = vantage name, line2 = "City • Date"
 * - Private + viewer ≠ owner: line1 = null, line2 = "City • Date"
 * - Private + viewer = owner: line1 = vantage name, line2 = "Date • City"
 */
export function getFullScreenOverlayLines(
  vantageName: string | null | undefined,
  city: string,
  dateIso: string,
  vantageCategory?: VantageCategory | null,
  viewerIsOwner?: boolean
): { line1: string | null; line2: string } {
  const dateStr = formatOverlayDate(dateIso);
  const cityTrimmed = (city ?? '').trim();
  const isPrivate = isPrivateVantage(vantageName, vantageCategory);

  if (isPrivate && !viewerIsOwner) {
    const line2 = cityTrimmed ? `${cityTrimmed} • ${dateStr}` : dateStr;
    return { line1: null, line2 };
  }
  if (isPrivate && viewerIsOwner) {
    const line2 = cityTrimmed ? `${dateStr} • ${cityTrimmed}` : dateStr;
    const line1 = vantageName?.trim() ? toTitleCaseVantage(vantageName.trim()) : null;
    return { line1, line2 };
  }
  const line2 = cityTrimmed ? `${cityTrimmed} • ${dateStr}` : dateStr;
  const line1 = vantageName?.trim() ? toTitleCaseVantage(vantageName.trim()) : null;
  return { line1, line2 };
}

/** Whether to show vantage name on a gallery tile/overlay for this row (public, or private + owner). */
export function shouldShowVantageName(
  vantageCategory: VantageCategory | null | undefined,
  viewerIsOwner: boolean
): boolean {
  if (vantageCategory === 'public') return true;
  if (vantageCategory === 'private') return viewerIsOwner;
  return true;
}

/**
 * For stats: get the normalized vantage from a log row.
 * Prefers normalized_vantage when present; otherwise normalizes vantage_name/user_input_vantage.
 */
export function getNormalizedVantageFromRow(row: {
  normalized_vantage?: string | null;
  vantage_name?: string | null;
  user_input_vantage?: string | null;
}): string | null {
  const fromCol = row.normalized_vantage ?? null;
  if (fromCol != null && fromCol.trim() !== '') return fromCol.trim();
  const raw = (row.user_input_vantage ?? row.vantage_name ?? '').trim();
  if (raw === '') return null;
  const { normalizedVantage } = normalizeVantageForStorage(raw);
  return normalizedVantage;
}
