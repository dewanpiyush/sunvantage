/**
 * Shared foreground-session guard for at-most-one location reconciliation
 * per app foreground session (unless stale after long background gap).
 */

import { AppState, type AppStateStatus } from 'react-native';
import { RECONCILE_STALE_MS } from '@/lib/activeSunriseCity';

let sessionReconciled = false;
let lastReconciledAtMs = 0;
let reconcileInFlight = false;
let listenerAttached = false;
const onForeground = new Set<() => void>();

function resetSession() {
  sessionReconciled = false;
}

export function shouldRunLocationReconcile(): boolean {
  if (!sessionReconciled) return true;
  return Date.now() - lastReconciledAtMs > RECONCILE_STALE_MS;
}

export function markLocationReconciled() {
  sessionReconciled = true;
  lastReconciledAtMs = Date.now();
}

export function tryAcquireReconcileLock(): boolean {
  if (reconcileInFlight) return false;
  reconcileInFlight = true;
  return true;
}

export function releaseReconcileLock() {
  reconcileInFlight = false;
}

function handleAppStateChange(next: AppStateStatus) {
  if (next === 'background' || next === 'inactive') {
    resetSession();
    return;
  }
  if (next === 'active') {
    onForeground.forEach((fn) => fn());
  }
}

/** Subscribe to foreground transitions; returns unsubscribe. */
export function subscribeForegroundReconcile(fn: () => void): () => void {
  if (!listenerAttached) {
    listenerAttached = true;
    AppState.addEventListener('change', handleAppStateChange);
  }
  onForeground.add(fn);
  return () => {
    onForeground.delete(fn);
  };
}
