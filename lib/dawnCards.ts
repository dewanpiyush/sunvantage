import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAWN_CARD_SET, type DawnCardCopy } from './dawnCardSet';

export type DawnCard = {
  verb: string;
  text: string;
};

const FIRST_OPEN_KEY = 'first_open_date';

const FALLBACK_CARD: DawnCard = {
  verb: 'RESET',
  text: 'The sun does not carry yesterday.\nNeither do you have to.',
};

let cachedDawnCard: DawnCard | null = null;

export const getCachedDawnCard = (): DawnCard | null => cachedDawnCard;

async function ensureFirstOpenDateIso(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    if (existing) return existing;
    const iso = new Date().toISOString();
    await AsyncStorage.setItem(FIRST_OPEN_KEY, iso);
    return iso;
  } catch {
    return new Date().toISOString();
  }
}

export const getDaysSinceFirstOpen = async (): Promise<number> => {
  const stored = await ensureFirstOpenDateIso();
  const firstDate = new Date(stored);
  const today = new Date();
  const diffTime = today.getTime() - firstDate.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) && days >= 0 ? days : 0;
};

export const getTodayDawnCard = async (): Promise<DawnCard> => {
  try {
    const daysSinceFirstOpen = await getDaysSinceFirstOpen();
    const index = DAWN_CARD_SET.length === 0 ? 0 : daysSinceFirstOpen % DAWN_CARD_SET.length;
    const card: DawnCardCopy | undefined = DAWN_CARD_SET[index];
    if (!card) {
      cachedDawnCard = FALLBACK_CARD;
      return FALLBACK_CARD;
    }
    const resolved = { verb: card.verb, text: card.prompt };
    cachedDawnCard = resolved;
    return resolved;
  } catch {
    cachedDawnCard = FALLBACK_CARD;
    return FALLBACK_CARD;
  }
};

