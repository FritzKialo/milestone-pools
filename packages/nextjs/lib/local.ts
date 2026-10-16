"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_POOL_CHAIN, uidOf } from "~~/lib/chains";

/**
 * Small per-browser conveniences (saved initiatives, dismissed hints).
 * Stored in localStorage when it works and kept in memory when it does not.
 * Nothing here is shared with other people or devices.
 */

type Store<T> = {
  get: () => T;
  set: (v: T) => void;
  subscribe: (cb: () => void) => () => void;
};

function makeStore<T>(key: string, empty: T, valid: (v: unknown) => v is T): Store<T> {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (cache !== null) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : empty;
      cache = valid(parsed) ? parsed : empty;
    } catch {
      cache = empty;
    }
    return cache;
  };

  const set = (v: T) => {
    cache = v;
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // Private window or blocked storage: keep the value in memory only.
    }
    listeners.forEach(l => l());
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  return { get, set, subscribe };
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");

const isViewMode = (v: unknown): v is "cards" | "table" => v === "cards" || v === "table";

const EMPTY_STRINGS: string[] = [];

// Saved initiatives are stored as "chainId:id". The first version stored bare numbers, read here as the first network.
const savedStore = makeStore<string[]>("milestone-pools:saved", EMPTY_STRINGS, isStringArray);
const dismissedStore = makeStore<string[]>("milestone-pools:dismissed", EMPTY_STRINGS, isStringArray);

const viewStore = makeStore<"cards" | "table">("milestone-pools:view", "cards", isViewMode);

/** Whether Explore shows cards or a table. Remembered in this browser only. */
export function useViewMode() {
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.get, () => "cards" as const);
  const setView = useCallback((v: "cards" | "table") => viewStore.set(v), []);
  return { view, setView };
}

/** Initiatives the visitor starred, kept in this browser only. Each is identified by its uid, for example "8453:12". */
export function useWatchlist() {
  const stored = useSyncExternalStore(savedStore.subscribe, savedStore.get, () => EMPTY_STRINGS);
  const saved = useMemo(
    () => stored.map(x => (/^\d+$/.test(x) && DEFAULT_POOL_CHAIN ? uidOf(DEFAULT_POOL_CHAIN.id, Number(x)) : x)),
    [stored],
  );
  const toggle = useCallback((uid: string) => {
    const cur = savedStore.get();
    const legacy = DEFAULT_POOL_CHAIN && uid.startsWith(`${DEFAULT_POOL_CHAIN.id}:`) ? uid.split(":")[1] : null;
    const has = cur.includes(uid) || (legacy !== null && cur.includes(legacy));
    savedStore.set(has ? cur.filter(x => x !== uid && x !== legacy) : [...cur, uid]);
  }, []);
  return { saved, isSaved: (uid: string) => saved.includes(uid), toggle };
}

/** A hint or banner the visitor closed. Starts as dismissed on the server to avoid a flash. */
export function useDismissed(key: string) {
  // The snapshot is a boolean so React always sees a stable value (a new array each call causes an infinite loop).
  const dismissed = useSyncExternalStore(
    dismissedStore.subscribe,
    () => dismissedStore.get().includes(key),
    () => true,
  );
  const dismiss = useCallback(() => {
    const cur = dismissedStore.get();
    if (!cur.includes(key)) dismissedStore.set([...cur, key]);
  }, [key]);
  return { dismissed, dismiss };
}
