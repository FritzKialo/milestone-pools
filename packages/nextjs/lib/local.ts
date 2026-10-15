"use client";

import { useCallback, useSyncExternalStore } from "react";

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

const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(x => Number.isInteger(x));
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");

const isViewMode = (v: unknown): v is "cards" | "table" => v === "cards" || v === "table";

const EMPTY_NUMBERS: number[] = [];
const EMPTY_STRINGS: string[] = [];

const savedStore = makeStore<number[]>("milestone-pools:saved", EMPTY_NUMBERS, isNumberArray);
const dismissedStore = makeStore<string[]>("milestone-pools:dismissed", EMPTY_STRINGS, isStringArray);

const viewStore = makeStore<"cards" | "table">("milestone-pools:view", "cards", isViewMode);

/** Whether Explore shows cards or a table. Remembered in this browser only. */
export function useViewMode() {
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.get, () => "cards" as const);
  const setView = useCallback((v: "cards" | "table") => viewStore.set(v), []);
  return { view, setView };
}

/** Initiatives the visitor starred, kept in this browser only. */
export function useWatchlist() {
  const saved = useSyncExternalStore(savedStore.subscribe, savedStore.get, () => EMPTY_NUMBERS);
  const toggle = useCallback((id: number) => {
    const cur = savedStore.get();
    savedStore.set(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  }, []);
  return { saved, isSaved: (id: number) => saved.includes(id), toggle };
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
