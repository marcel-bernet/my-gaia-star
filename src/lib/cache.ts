/**
 * Small helpers for "load it once, share the answer". A failed load is
 * forgotten, so the next call tries again instead of failing forever.
 */

/** Wrap `load` so it runs once and every caller shares its promise. */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load().catch(e => {
      pending = null;
      throw e;
    });
    return pending;
  };
}

/** Like `once`, but separately for each key. */
export function oncePerKey<T>(load: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const cache = new Map<string, Promise<T>>();
  return key => {
    let p = cache.get(key);
    if (!p) {
      p = load(key);
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    return p;
  };
}

/** A JSON file shipped with the site, from public/. */
export async function fetchBundled<T>(file: string): Promise<T> {
  const r = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

/**
 * `p`, but rejected as soon as `signal` aborts. The work behind `p` carries
 * on, so a shared (cached) request isn't cancelled for its other callers.
 */
export function abortable<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(signal.reason);
  return Promise.race([
    p,
    new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  ]);
}
