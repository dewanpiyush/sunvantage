import Constants from 'expo-constants';

export type StoreLinks = {
  /** iOS TestFlight public link or App Store listing URL. */
  ios?: string;
  /** Android internal testing opt-in link or Play Store listing URL. */
  android?: string;
  /** Optional canonical landing page (marketing / invite). */
  landing?: string;
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

export function getConfiguredStoreLinks(): StoreLinks {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const storeLinks = (extra?.storeLinks as Record<string, unknown> | undefined) ?? undefined;

  return {
    ios: asNonEmptyString(storeLinks?.ios),
    android: asNonEmptyString(storeLinks?.android),
    landing: asNonEmptyString(storeLinks?.landing),
  };
}

export function buildShareInstallLinksText(): string | null {
  const links = getConfiguredStoreLinks();
  const lines: string[] = [];
  if (links.ios) lines.push(`iOS: ${links.ios}`);
  if (links.android) lines.push(`Android: ${links.android}`);
  if (lines.length === 0) return null;
  return lines.join('\n');
}

