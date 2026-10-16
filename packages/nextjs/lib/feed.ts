"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { initiativePath } from "~~/lib/chains";
import {
  type PoolEvent,
  TOKEN_SYMBOL,
  blockKey,
  fmtAmount,
  loadMetadata,
  shortAddr,
  useBlockTimes,
  useListings,
  usePoolEvents,
} from "~~/lib/pools";

export type FeedKind = "created" | "funded" | "review" | "paid" | "finished" | "ended" | "refund" | "work";

const KIND: Record<string, FeedKind> = {
  InitiativeCreated: "created",
  Contributed: "funded",
  GranteeSelected: "work",
  MilestoneSubmitted: "work",
  ReviewVote: "review",
  MilestoneRejected: "review",
  MilestoneApproved: "paid",
  InitiativeCompleted: "finished",
  InitiativeFailed: "ended",
  InitiativeCancelled: "ended",
  Refunded: "refund",
};

export const FEED_EVENTS = Object.keys(KIND);
export const kindOf = (eventName: string): FeedKind | undefined => KIND[eventName];

/** Titles of every initiative, loaded from their metadata and cached. */
export function useTitleMap() {
  const { listings } = useListings();
  const { data } = useQuery({
    queryKey: ["title-map", listings.map(l => `${l.uid}:${l.metadataURI.length}`).join(",")],
    enabled: listings.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        listings.map(async l => [l.uid, (await loadMetadata(l.metadataURI, `Initiative #${l.id}`)).title] as const),
      );
      return Object.fromEntries(entries) as Record<string, string>;
    },
  });
  return useCallback((uid: string) => data?.[uid] ?? `Initiative #${uid.split(":")[1]}`, [data]);
}

/** One plain-language line for a contract event. */
export function describeEvent(e: PoolEvent, title: (uid: string) => string): string {
  const a = e.args ?? {};
  const name = title(e.uid ?? "");
  const amt = (v: bigint) => `${fmtAmount(v)} ${TOKEN_SYMBOL}`;
  const m = Number(a.milestone) + 1;
  switch (e.eventName) {
    case "InitiativeCreated":
      return `${shortAddr(a.proposer)} created ${name}`;
    case "Contributed":
      return `${shortAddr(a.funder)} contributed ${amt(a.amount)} to ${name}`;
    case "GranteeSelected":
      return `${shortAddr(a.grantee)} was chosen to deliver ${name}`;
    case "MilestoneSubmitted":
      return `Milestone ${m} of ${name} was submitted for review`;
    case "ReviewVote":
      return `${shortAddr(a.reviewer)} voted to ${a.approve ? "approve" : "reject"} milestone ${m} of ${name}`;
    case "MilestoneRejected":
      return `Milestone ${m} of ${name} was rejected`;
    case "MilestoneApproved":
      return `Milestone ${m} of ${name} approved, ${amt(a.amount)} paid`;
    case "InitiativeCompleted":
      return `${name} completed all milestones`;
    case "InitiativeFailed":
      return `${name} failed. Remaining funds can be refunded.`;
    case "InitiativeCancelled":
      return `${name} was cancelled for inactivity`;
    case "Refunded":
      return `${shortAddr(a.funder)} claimed a ${amt(a.amount)} refund from ${name}`;
    default:
      return "";
  }
}

export type FeedItem = {
  key: string;
  /** Link to the initiative the event is about. */
  href: string;
  kind: FeedKind;
  text: string;
  time: number;
};

/** The latest events, newest first, with their block times. */
export function useFeed(limit = 12, kinds?: FeedKind[], address?: string) {
  const { data: events, isLoading } = usePoolEvents();
  const title = useTitleMap();
  const kindKey = kinds?.join(",") ?? "";
  const who = address?.toLowerCase();

  // Block numbers cannot be compared across networks, so take the newest few of each network,
  // look up their times, and then order the lot by time.
  const candidates = useMemo(() => {
    const allowed = kindKey ? kindKey.split(",") : null;
    const perChain = new Map<number, PoolEvent[]>();
    (events ?? []).forEach(e => {
      const k = KIND[e.eventName];
      if (!k || !e.uid || (allowed && !allowed.includes(k))) return;
      if (who && !Object.values(e.args ?? {}).some(v => typeof v === "string" && v.toLowerCase() === who)) return;
      const list = perChain.get(e.chainId) ?? [];
      list.push(e);
      perChain.set(e.chainId, list);
    });
    return Array.from(perChain.values()).flatMap(list => list.slice(-limit));
  }, [events, limit, kindKey, who]);

  const { data: times } = useBlockTimes(
    useMemo(() => candidates.map(e => ({ chainId: e.chainId, block: e.blockNumber })), [candidates]),
  );

  const items = useMemo<FeedItem[]>(
    () =>
      candidates
        .map(e => ({
          e,
          time: times?.[blockKey(e.chainId, e.blockNumber)] ?? 0,
        }))
        .sort((x, y) =>
          x.time !== y.time
            ? y.time - x.time
            : x.e.chainId !== y.e.chainId
              ? x.e.chainId - y.e.chainId
              : x.e.blockNumber === y.e.blockNumber
                ? y.e.logIndex - x.e.logIndex
                : x.e.blockNumber > y.e.blockNumber
                  ? -1
                  : 1,
        )
        .slice(0, limit)
        .map(({ e, time }) => ({
          key: `${e.chainId}-${e.transactionHash}-${e.logIndex}`,
          href: initiativePath({ chainId: e.chainId, id: Number(e.args?.id) }),
          kind: KIND[e.eventName],
          text: describeEvent(e, title),
          time,
        })),
    [candidates, title, times, limit],
  );

  return { items, isLoading };
}

/** "3 minutes ago" from a unix time. Falls back to nothing when the time is not known yet. */
export function ago(ts: number, now: number): string {
  if (!ts) return "";
  const s = Math.max(0, now - ts);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}
