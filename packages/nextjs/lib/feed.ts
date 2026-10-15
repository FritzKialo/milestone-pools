"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type PoolEvent,
  TOKEN_SYMBOL,
  fmtAmount,
  loadMetadata,
  shortAddr,
  useListings,
  usePoolEvents,
} from "~~/lib/pools";
import { useBlockTimes } from "~~/lib/stats";

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
    queryKey: ["title-map", listings.map(l => `${l.id}:${l.metadataURI.length}`).join(",")],
    enabled: listings.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        listings.map(async l => [l.id, (await loadMetadata(l.metadataURI, `Initiative #${l.id}`)).title] as const),
      );
      return Object.fromEntries(entries) as Record<number, string>;
    },
  });
  return useCallback((id: number) => data?.[id] ?? `Initiative #${id}`, [data]);
}

/** One plain-language line for a contract event. */
export function describeEvent(e: PoolEvent, title: (id: number) => string): string {
  const a = e.args ?? {};
  const name = title(Number(a.id));
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
  id: number;
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

  const picked = useMemo(() => {
    const allowed = kindKey ? kindKey.split(",") : null;
    return (events ?? [])
      .filter(e => {
        const k = KIND[e.eventName];
        if (!k || (allowed && !allowed.includes(k))) return false;
        if (!who) return true;
        return Object.values(e.args ?? {}).some(v => typeof v === "string" && v.toLowerCase() === who);
      })
      .slice(-limit)
      .reverse();
  }, [events, limit, kindKey, who]);

  const { data: times } = useBlockTimes(useMemo(() => picked.map(e => e.blockNumber), [picked]));

  const items = useMemo<FeedItem[]>(
    () =>
      picked.map(e => ({
        key: `${e.transactionHash}-${e.logIndex}`,
        id: Number(e.args?.id),
        kind: KIND[e.eventName],
        text: describeEvent(e, title),
        time: times?.[e.blockNumber.toString()] ?? 0,
      })),
    [picked, title, times],
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
