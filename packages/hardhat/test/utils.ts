// Shared constants and helpers for the MilestonePools tests. Contains no tests itself.

export const Status = { Funding: 0, Selecting: 1, Active: 2, Completed: 3, Failed: 4, Cancelled: 5 } as const;
export const Phase = { AwaitingSubmission: 0, UnderReview: 1 } as const;

export const DAY = 24 * 60 * 60;
export const REVIEW_PERIOD = 14 * DAY;
export const SUBMISSION_WINDOW = 60 * DAY;
export const SELECTION_PERIOD = 30 * DAY;

/** USDC-style amounts: usdc(400) = 400 * 10^6 */
export const usdc = (n: number | bigint): bigint => BigInt(n) * 1_000_000n;

/** Small deterministic PRNG (mulberry32) so randomized runs are reproducible from the seed. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}
