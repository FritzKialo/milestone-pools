"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { type PoolEvent, usePoolEvents } from "~~/lib/pools";

/* ----------------------------------------------------------------------------
 * Block timestamps, cached for the life of the page so each block is read once
 * ------------------------------------------------------------------------- */

const blockTimes = new Map<string, number>();

export function useBlockTimes(blocks: bigint[]) {
  const client = usePublicClient();
  const unique = useMemo(() => Array.from(new Set(blocks.map(b => b.toString()))), [blocks]);
  const key = unique.join(",");

  return useQuery({
    queryKey: ["block-times", key],
    enabled: !!client && unique.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const missing = unique.filter(b => !blockTimes.has(b));
      for (let i = 0; i < missing.length; i += 20) {
        await Promise.all(
          missing.slice(i, i + 20).map(async b => {
            const blk = await client!.getBlock({ blockNumber: BigInt(b) });
            blockTimes.set(b, Number(blk.timestamp));
          }),
        );
      }
      const out: Record<string, number> = {};
      unique.forEach(b => (out[b] = blockTimes.get(b) ?? 0));
      return out;
    },
  });
}

/* ----------------------------------------------------------------------------
 * Contributions, with times
 * ------------------------------------------------------------------------- */

export type Contribution = {
  id: number;
  funder: `0x${string}`;
  amount: bigint;
  time: number;
  block: bigint;
  logIndex: number;
};

export function useContributions() {
  const { data: events, isLoading: eventsLoading } = usePoolEvents();
  const raw = useMemo(() => (events ?? []).filter(e => e.eventName === "Contributed"), [events]);
  const blocks = useMemo(() => raw.map(e => e.blockNumber), [raw]);
  const { data: times, isLoading: timesLoading } = useBlockTimes(blocks);

  const data = useMemo<Contribution[]>(() => {
    if (raw.length === 0) return [];
    if (!times) return [];
    return raw
      .map(e => ({
        id: Number(e.args.id),
        funder: e.args.funder as `0x${string}`,
        amount: e.args.amount as bigint,
        time: times[e.blockNumber.toString()] ?? 0,
        block: e.blockNumber,
        logIndex: e.logIndex,
      }))
      .sort((a, b) => (a.block === b.block ? a.logIndex - b.logIndex : a.block < b.block ? -1 : 1));
  }, [raw, times]);

  return { data, isLoading: eventsLoading || (raw.length > 0 && timesLoading) };
}

/** Running total after each contribution. */
export function cumulative(list: Contribution[]) {
  let total = 0n;
  return list.map(c => {
    total += c.amount;
    return { time: c.time, total, amount: c.amount, funder: c.funder };
  });
}

export type BackerTotal = { funder: `0x${string}`; total: bigint; count: number };

export function topBackers(list: Contribution[], limit = 5): BackerTotal[] {
  const map = new Map<string, BackerTotal>();
  for (const c of list) {
    const k = c.funder.toLowerCase();
    const cur = map.get(k) ?? { funder: c.funder, total: 0n, count: 0 };
    cur.total += c.amount;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => (b.total === a.total ? 0 : b.total > a.total ? 1 : -1))
    .slice(0, limit);
}

export const sumEvents = (events: PoolEvent[] | undefined, name: string, field: string) =>
  (events ?? []).filter(e => e.eventName === name).reduce((s, e) => s + ((e.args?.[field] as bigint) ?? 0n), 0n);
