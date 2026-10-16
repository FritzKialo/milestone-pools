"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { DAY, type Listing, type PoolEvent, TOKEN_DECIMALS, usePoolEvents } from "~~/lib/pools";

/* ----------------------------------------------------------------------------
 * Block timestamps, cached for the life of the page so each block is read once
 * ------------------------------------------------------------------------- */

const blockTimes = new Map<string, number>();

export function useBlockTimes(blocks: bigint[]) {
  const { targetNetwork } = useTargetNetwork();
  const client = usePublicClient({ chainId: targetNetwork.id });
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

/* ----------------------------------------------------------------------------
 * Reviewers and wallet profiles
 * ------------------------------------------------------------------------- */

export type ReviewerStat = { reviewer: `0x${string}`; votes: number; committees: number };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Reviewers ranked by votes cast, then by how many committees they sit on. */
export function topReviewers(events: PoolEvent[] | undefined, listings: Listing[], limit = 5): ReviewerStat[] {
  const map = new Map<string, ReviewerStat>();
  const entry = (addr: `0x${string}`) => {
    const k = addr.toLowerCase();
    const cur = map.get(k) ?? { reviewer: addr, votes: 0, committees: 0 };
    map.set(k, cur);
    return cur;
  };
  listings.forEach(l => l.reviewers.forEach(r => (entry(r).committees += 1)));
  (events ?? []).filter(e => e.eventName === "ReviewVote").forEach(e => (entry(e.args.reviewer).votes += 1));
  return Array.from(map.values())
    .sort((a, b) => b.votes - a.votes || b.committees - a.committees)
    .slice(0, limit);
}

export type Profile = {
  backed: { id: number; total: bigint; count: number }[];
  created: number[];
  reviewing: { id: number; votes: number }[];
  receiving: { id: number; paid: bigint }[];
  totalBacked: bigint;
  totalReceived: bigint;
  votesCast: number;
};

export function buildProfile(
  address: string,
  listings: Listing[],
  contributions: Contribution[],
  events: PoolEvent[] | undefined,
): Profile {
  const backedMap = new Map<number, { id: number; total: bigint; count: number }>();
  contributions
    .filter(c => same(c.funder, address))
    .forEach(c => {
      const cur = backedMap.get(c.id) ?? { id: c.id, total: 0n, count: 0 };
      cur.total += c.amount;
      cur.count += 1;
      backedMap.set(c.id, cur);
    });
  const backed = Array.from(backedMap.values()).sort((a, b) => b.id - a.id);

  const votes = new Map<number, number>();
  (events ?? [])
    .filter(e => e.eventName === "ReviewVote" && same(e.args.reviewer, address))
    .forEach(e => votes.set(Number(e.args.id), (votes.get(Number(e.args.id)) ?? 0) + 1));

  const paid = new Map<number, bigint>();
  (events ?? [])
    .filter(e => e.eventName === "MilestoneApproved" && same(e.args.grantee, address))
    .forEach(e => paid.set(Number(e.args.id), (paid.get(Number(e.args.id)) ?? 0n) + (e.args.amount as bigint)));

  const created = listings.filter(l => same(l.proposer, address)).map(l => l.id);
  const reviewing = listings
    .filter(l => l.reviewers.some(r => same(r, address)))
    .map(l => ({ id: l.id, votes: votes.get(l.id) ?? 0 }));
  const receiving = listings.filter(l => same(l.grantee, address)).map(l => ({ id: l.id, paid: paid.get(l.id) ?? 0n }));

  return {
    backed,
    created: created.sort((a, b) => b - a),
    reviewing: reviewing.sort((a, b) => b.id - a.id),
    receiving: receiving.sort((a, b) => b.id - a.id),
    totalBacked: backed.reduce((s, b) => s + b.total, 0n),
    totalReceived: receiving.reduce((s, r) => s + r.paid, 0n),
    votesCast: Array.from(votes.values()).reduce((s, v) => s + v, 0),
  };
}

/* ----------------------------------------------------------------------------
 * Analytics
 * ------------------------------------------------------------------------- */

export type DayBucket = { label: string; total: number; count: number };

/** Contributions grouped by day for the last `days` days, oldest first. */
export function dailyContributions(list: Contribution[], now: number, days = 14): DayBucket[] {
  const todayStart = Math.floor(now / DAY) * DAY;
  const first = todayStart - (days - 1) * DAY;
  const out: DayBucket[] = Array.from({ length: days }, (_, i) => ({
    label: new Date((first + i * DAY) * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    total: 0,
    count: 0,
  }));
  list.forEach(c => {
    const idx = Math.floor((c.time - first) / DAY);
    if (idx >= 0 && idx < days) {
      out[idx].total += Number(c.amount) / 10 ** TOKEN_DECIMALS;
      out[idx].count += 1;
    }
  });
  return out;
}

/** How committee votes split between approve and reject. */
export function voteSplit(events: PoolEvent[] | undefined) {
  let approve = 0;
  let reject = 0;
  (events ?? [])
    .filter(e => e.eventName === "ReviewVote")
    .forEach(e => {
      if (e.args.approve) approve += 1;
      else reject += 1;
    });
  return { approve, reject };
}

export type CreatorStat = { proposer: `0x${string}`; initiatives: number; raised: bigint };

export function topCreators(listings: Listing[], limit = 5): CreatorStat[] {
  const map = new Map<string, CreatorStat>();
  listings.forEach(l => {
    const k = l.proposer.toLowerCase();
    const cur = map.get(k) ?? { proposer: l.proposer, initiatives: 0, raised: 0n };
    cur.initiatives += 1;
    cur.raised += l.raised;
    map.set(k, cur);
  });
  return Array.from(map.values())
    .sort((a, b) => b.initiatives - a.initiatives || (b.raised > a.raised ? 1 : b.raised < a.raised ? -1 : 0))
    .slice(0, limit);
}

export type GranteeStat = { grantee: `0x${string}`; paid: bigint; milestones: number };

export function topGrantees(events: PoolEvent[] | undefined, limit = 5): GranteeStat[] {
  const map = new Map<string, GranteeStat>();
  (events ?? [])
    .filter(e => e.eventName === "MilestoneApproved")
    .forEach(e => {
      const k = (e.args.grantee as string).toLowerCase();
      const cur = map.get(k) ?? { grantee: e.args.grantee, paid: 0n, milestones: 0 };
      cur.paid += e.args.amount as bigint;
      cur.milestones += 1;
      map.set(k, cur);
    });
  return Array.from(map.values())
    .sort((a, b) => (b.paid > a.paid ? 1 : b.paid < a.paid ? -1 : 0))
    .slice(0, limit);
}
