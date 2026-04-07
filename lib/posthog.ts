import posthog from 'posthog-js';

export type PosthogInitOptions = {
  /** Your PostHog project API key/token. If omitted, PostHog stays disabled (no-ops). */
  apiKey?: string;
  /** Override the PostHog host (e.g. `https://app.posthog.com` or self-hosted endpoint). */
  apiHost?: string;
  /** Enables PostHog debug logging. */
  debug?: boolean;
  /**
   * PostHog autocapture is DOM-oriented; for React Native we default to `false`
   * to avoid noisy/unsupported capture behavior.
   */
  autocapture?: boolean;
  /** Whether to capture `$pageview` automatically (default `false` for RN). */
  capturePageview?: boolean;
};

let initialized = false;

function safeStringRecord(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, any>;
}

// Web-only auto-init.
// This keeps React Native builds quiet (no `window`), but enables analytics on Expo Web.
if (typeof window !== 'undefined') {
  // Use the env var you added to `.env.local`. We keep a fallback to the token-name key
  // in case you had that setup previously.
  const apiKey =
    (process.env.NEXT_PUBLIC_POSTHOG_KEY as string | undefined) ??
    (process.env['phc_udv8K6Lw9faf5da8PSsCAykTV2sZwNkL5toGvCePug8z'] as string | undefined);
  const host = 'https://eu.i.posthog.com'.trim();

  if (typeof apiKey === 'string' && apiKey.trim()) {
    posthog.init(apiKey.trim(), {
      api_host: host,
      capture_pageview: false, // we’ll control events manually
    });
    initialized = true;
  }
}

/**
 * Initialize PostHog.
 * Safe to call multiple times; the first valid `apiKey` wins.
 */
export function initPosthog(options: PosthogInitOptions): void {
  const apiKey = options?.apiKey?.trim();
  if (!apiKey || initialized) return;

  // Keep configuration intentionally minimal and RN-safe.
  posthog.init(apiKey, {
    api_host: options.apiHost,
    debug: options.debug ?? false,
    capture_pageview: options.capturePageview ?? false,
    // `posthog-js` typings allow this, but we still cast since config options evolve.
    autocapture: options.autocapture ?? false,
  } as any);

  initialized = true;
}

export function isPosthogInitialized(): boolean {
  return initialized;
}

/** Track a custom event (no-op until initialized). */
export function captureEvent(
  eventName: string,
  properties?: Record<string, any> | null
): void {
  if (!initialized) return;
  if (!eventName?.trim()) return;
  try {
    posthog.capture(eventName, properties ?? null);
  } catch {
    // analytics should never break app flows
  }
}

/** Identify the current user (no-op until initialized). */
export function identifyUser(
  distinctId: string | undefined | null,
  traits?: Record<string, any> | null
): void {
  if (!initialized) return;
  const id = distinctId?.toString().trim();
  if (!id) return;
  try {
    posthog.identify(id, safeStringRecord(traits));
  } catch {
    // ignore
  }
}

/**
 * Set person-level properties (no-op until initialized).
 * - `$set` for `props`
 * - `$set_once` for `propsOnce`
 */
export function setPersonProperties(
  props?: Record<string, any> | null,
  propsOnce?: Record<string, any> | null
): void {
  if (!initialized) return;
  try {
    posthog.setPersonProperties(safeStringRecord(props), safeStringRecord(propsOnce));
  } catch {
    // ignore
  }
}

/** Reset PostHog state and disable this wrapper. */
export function resetPosthog(): void {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    // ignore
  } finally {
    initialized = false;
  }
}

export default posthog;

