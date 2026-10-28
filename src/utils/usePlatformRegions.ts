import { useCallback, useEffect, useState } from 'react';
import { platformApi } from '../api/endpoints';
import type { PlatformRegions } from '../api/types';

// One copy for the whole app: every country and currency list reads it, and the admin's changes refresh it for all of them.
let cache: { at: number; data: PlatformRegions } | null = null;
let inflight: Promise<PlatformRegions> | null = null;
const listeners = new Set<(r: PlatformRegions) => void>();
const FRESH_MS = 5 * 60_000; // the API caches it for five minutes too

function load(force: boolean): Promise<PlatformRegions> {
  if (!force && cache && Date.now() - cache.at < FRESH_MS) return Promise.resolve(cache.data);
  inflight ??= platformApi
    .regions(force)
    .then((data) => {
      cache = { at: Date.now(), data };
      listeners.forEach((fn) => fn(data));
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The countries and currencies the admin enabled (GET /platform/regions). `regions` is null until it has loaded (or if it could not). */
export function usePlatformRegions() {
  const [regions, setRegions] = useState<PlatformRegions | null>(cache?.data ?? null);
  useEffect(() => {
    listeners.add(setRegions);
    void load(false).then(setRegions, () => {});
    return () => {
      listeners.delete(setRegions);
    };
  }, []);
  /** Fetch again now (after the admin changed something). */
  const reload = useCallback(() => load(true).then(() => undefined), []);
  return { regions, reload };
}
