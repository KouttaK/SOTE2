/**
 * src/shared/utils/serviceWorkerSafety.ts
 */

type InvalidationListener = () => void;
const invalidationListeners = new Set<InvalidationListener>();

export function onContextInvalidated(fn: InvalidationListener): () => void {
  invalidationListeners.add(fn);
  return () => invalidationListeners.delete(fn);
}

export function notifyContextInvalidated(): void {
  for (const listener of invalidationListeners) {
    try {
      listener();
    } catch {}
  }
}

export async function safeContextCall<T>(fn: () => Promise<T>, fallback: T): Promise<T>;
export async function safeContextCall<T>(fn: () => Promise<T>): Promise<T | undefined>;
export async function safeContextCall<T>(fn: () => Promise<T>, fallback?: T): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err: any) {
    const rawMsg = err?.message || String(err || '');
    const msg = String(rawMsg).toLowerCase();
    if (
      msg.includes('no sw') ||
      msg.includes('extension context invalidated') ||
      msg.includes('the message port closed') ||
      msg.includes('could not establish connection') ||
      msg.includes('receiving end does not exist')
    ) {
      console.debug('[SOTE] Aborted due to context invalidation (reload/update). Expected behavior.', rawMsg);
      notifyContextInvalidated();
      return fallback;
    }
    console.error('[SOTE] Unhandled error in safeContextCall:', err);
    throw err;
  }
}
