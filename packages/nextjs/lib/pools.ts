"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseEventLogs, parseUnits } from "viem";
import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { POOL_CHAINS, type PoolChain, uidOf } from "~~/lib/chains";

/* ----------------------------------------------------------------------------
 * Constants that mirror the contract
 * ------------------------------------------------------------------------- */

export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "USDC";
export const DAY = 86_400;
export const REVIEW_PERIOD = 14 * DAY;
export const SUBMISSION_WINDOW = 60 * DAY;
export const MAX_ROUNDS = 3;
export const MIN_REVIEWERS = 3;
export const MAX_REVIEWERS = 9;
export const MAX_MILESTONES = 10;

export const STATUS = ["Funding", "Selecting", "Active", "Completed", "Failed", "Cancelled"] as const;
export type StatusName = (typeof STATUS)[number];
export const PHASE = ["AwaitingSubmission", "UnderReview"] as const;

export const CATEGORIES = [
  "Public goods",
  "Education",
  "Infrastructure",
  "Research",
  "Community",
  "Tooling",
  "Media",
  "Other",
];

export type Initiative = {
  /** The initiative's number on its own network. */
  id: number;
  /** The network it lives on. */
  chainId: number;
  /** Network and number together, for example "8453:12". Use this as the key. */
  uid: string;
  token: `0x${string}`;
  grantee: `0x${string}`;
  proposer: `0x${string}`;
  goal: bigint;
  raised: bigint;
  released: bigint;
  refundPool: bigint;
  fundingDeadline: number;
  selectionDeadline: number;
  lastActivity: number;
  reviewStartedAt: number;
  backers: number;
  qualifyBps: number;
  reviewNo: number;
  reviewerCount: number;
  threshold: number;
  currentMilestone: number;
  submissionsForCurrent: number;
  approvals: number;
  rejections: number;
  status: StatusName;
  phase: "AwaitingSubmission" | "UnderReview";
  isRfp: boolean;
};

export type MetaLink = { label: string; url: string };
export type MetaFaq = { q: string; a: string };

export type Metadata = {
  title: string;
  summary: string;
  body?: string;
  milestones?: string[];
  image?: string;
  links?: MetaLink[];
  faq?: MetaFaq[];
};

export const MAX_LINKS = 5;
export const MAX_FAQ = 6;

export type Listing = Initiative & {
  /** Creation time (unix seconds), 0 until the block time has loaded. */
  createdAt: number;
  category: number;
  metadataURI: string;
  reviewers: `0x${string}`[];
  plan: bigint[];
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/* ----------------------------------------------------------------------------
 * Formatting
 * ------------------------------------------------------------------------- */

export const fmtAmount = (v: bigint, maxFraction = 2) => {
  const n = Number(formatUnits(v, TOKEN_DECIMALS));
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFraction });
};

export const parseAmount = (s: string): bigint | null => {
  const t = s.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null;
  try {
    return parseUnits(t, TOKEN_DECIMALS);
  } catch {
    return null;
  }
};

export const shortAddr = (a: string) => `${a.slice(0, 6)}\u2026${a.slice(-4)}`;

export const fmtDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export const fmtDateTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function timeLeft(deadline: number, now: number): string {
  const s = deadline - now;
  if (s <= 0) return "ended";
  const d = Math.floor(s / DAY);
  const h = Math.floor((s % DAY) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(m, 1)}m left`;
}

export const progressPct = (raised: bigint, goal: bigint) =>
  goal === 0n ? 0 : Number((raised * 10_000n) / goal) / 100;

/** True when `raised` meets the qualification share of the goal (same arithmetic as the contract). */
export const isQualified = (i: Pick<Initiative, "raised" | "goal" | "qualifyBps">) =>
  i.raised * 10_000n >= i.goal * BigInt(i.qualifyBps);

export const isLive = (i: Pick<Initiative, "status">) => ["Funding", "Selecting", "Active"].includes(i.status);
export const isClosedBad = (i: Pick<Initiative, "status">) => i.status === "Failed" || i.status === "Cancelled";

/* ----------------------------------------------------------------------------
 * Metadata encoding. The contract only stores a URI. We write a data: URI so
 * no external pinning service is needed, and read https:/ipfs: URIs as well.
 * ------------------------------------------------------------------------- */

const toBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

const fromBase64 = (b64: string) => {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeMetadata = (m: Metadata) => `data:application/json;base64,${toBase64(JSON.stringify(m))}`;

const sanitize = (raw: unknown, fallbackTitle: string): Metadata => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const arr = (v: unknown, max: number) => (Array.isArray(v) ? (v.slice(0, max) as unknown[]) : []);
  const httpsOnly = (v: unknown, max: number) => {
    const u = str(v, max).trim();
    return u.startsWith("https://") ? u : "";
  };
  const links = arr(r.links, MAX_LINKS)
    .map(x => {
      const o = (x ?? {}) as Record<string, unknown>;
      return { label: str(o.label, 40).trim(), url: httpsOnly(o.url, 300) };
    })
    .filter(l => l.label && l.url);
  const faq = arr(r.faq, MAX_FAQ)
    .map(x => {
      const o = (x ?? {}) as Record<string, unknown>;
      return { q: str(o.q, 160).trim(), a: str(o.a, 600).trim() };
    })
    .filter(f => f.q && f.a);
  return {
    title: str(r.title, 120) || fallbackTitle,
    summary: str(r.summary, 800),
    body: str(r.body, 6000) || undefined,
    milestones: Array.isArray(r.milestones) ? r.milestones.slice(0, MAX_MILESTONES).map(x => str(x, 160)) : undefined,
    image: httpsOnly(r.image, 500) || undefined,
    links: links.length ? links : undefined,
    faq: faq.length ? faq : undefined,
  };
};

export async function loadMetadata(uri: string, fallbackTitle: string): Promise<Metadata> {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      return sanitize(JSON.parse(fromBase64(uri.slice("data:application/json;base64,".length))), fallbackTitle);
    }
    let url = uri;
    if (uri.startsWith("ipfs://")) url = `https://ipfs.io/ipfs/${uri.slice(7)}`;
    if (!url.startsWith("https://")) return { title: fallbackTitle, summary: "" };
    const res = await fetch(url);
    if (!res.ok) return { title: fallbackTitle, summary: "" };
    return sanitize(await res.json(), fallbackTitle);
  } catch {
    return { title: fallbackTitle, summary: "" };
  }
}

export function useMetadata(uri: string | undefined, id: number) {
  const fallback = `Initiative #${id}`;
  const { data } = useQuery({
    queryKey: ["pool-metadata", uri],
    queryFn: () => loadMetadata(uri as string, fallback),
    enabled: !!uri,
    staleTime: Infinity,
  });
  return data ?? { title: fallback, summary: "" };
}

/* ----------------------------------------------------------------------------
 * Clock
 * ------------------------------------------------------------------------- */

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* ----------------------------------------------------------------------------
 * Contract events, fetched once and shared by every page through the query cache
 * ------------------------------------------------------------------------- */

export type PoolEvent = {
  eventName: string;
  chainId: number;
  /** Network and initiative number, when the event is about one initiative. */
  uid?: string;

  args: any;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: string;
};

type ChainClient = NonNullable<ReturnType<typeof getPublicClient>>;

/** Reads logs for a block range, splitting the range in half when a node refuses it as too large. */
async function getLogsRange(client: ChainClient, address: `0x${string}`, from: bigint, to: bigint): Promise<any[]> {
  try {
    return await client.getLogs({ address, fromBlock: from, toBlock: to });
  } catch (e) {
    if (to - from < 2_000n) throw e;
    const mid = from + (to - from) / 2n;
    const a = await getLogsRange(client, address, from, mid);
    const b = await getLogsRange(client, address, mid + 1n, to);
    return [...a, ...b];
  }
}

// Each network is scanned once from its deployment block, then only the newest blocks on every refresh.
const eventCache = new Map<number, { events: PoolEvent[]; next: bigint }>();
const REORG_BLOCKS = 12n;

async function fetchChainEvents(config: any, c: PoolChain): Promise<PoolEvent[]> {
  const client = getPublicClient(config, { chainId: c.id });
  if (!client) throw new Error(`No connection to ${c.label}`);
  const cached = eventCache.get(c.id) ?? { events: [], next: BigInt(c.pools.deployedOnBlock) };
  const latest = await client.getBlockNumber();
  const from = cached.events.length > 0 && cached.next > REORG_BLOCKS ? cached.next - REORG_BLOCKS : cached.next;
  if (latest < from) return cached.events;

  const logs = await getLogsRange(client, c.pools.address, from, latest);
  const parsed = parseEventLogs({ abi: c.pools.abi as any, logs }) as any[];
  const fresh: PoolEvent[] = parsed.map(l => ({
    eventName: l.eventName as string,
    chainId: c.id,
    uid: l.args?.id !== undefined ? uidOf(c.id, l.args.id) : undefined,
    args: l.args,
    blockNumber: l.blockNumber as bigint,
    logIndex: Number(l.logIndex),
    transactionHash: l.transactionHash as string,
  }));
  const kept = cached.events.filter(e => e.blockNumber < from);
  const events = [...kept, ...fresh];
  eventCache.set(c.id, { events, next: latest + 1n });
  return events;
}

/** Events from every network on the site, each marked with its network. Newest scan is shared by every page through the query cache. */
export function usePoolEvents() {
  const config = useConfig();
  return useQuery({
    queryKey: ["pool-events", POOL_CHAINS.map(c => `${c.id}:${c.pools.address}`).join(",")],
    enabled: POOL_CHAINS.length > 0,
    refetchInterval: 5000,
    queryFn: async (): Promise<PoolEvent[]> => {
      const results = await Promise.allSettled(POOL_CHAINS.map(c => fetchChainEvents(config, c)));
      const out: PoolEvent[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") out.push(...r.value);
        else console.warn(`Could not read events on ${POOL_CHAINS[i].label}`, r.reason);
        if (r.status !== "fulfilled") out.push(...(eventCache.get(POOL_CHAINS[i].id)?.events ?? []));
      });
      if (out.length === 0 && results.every(r => r.status === "rejected"))
        throw (results[0] as PromiseRejectedResult).reason;
      return out;
    },
  });
}

export const eventsFor = (events: PoolEvent[] | undefined, name: string, uid: string) =>
  (events ?? []).filter(e => e.eventName === name && e.uid === uid);

/* ----------------------------------------------------------------------------
 * Block times, cached for the life of the page so each block is read once
 * ------------------------------------------------------------------------- */

const blockTimes = new Map<string, number>();

export type BlockRef = { chainId: number; block: bigint };
export const blockKey = (chainId: number, block: bigint) => `${chainId}:${block}`;

/** Timestamps for blocks on any of the site's networks. The result is keyed by blockKey(chainId, block). */
export function useBlockTimes(refs: BlockRef[]) {
  const config = useConfig();
  const unique = useMemo(() => Array.from(new Set(refs.map(r => blockKey(r.chainId, r.block)))), [refs]);
  const key = unique.join(",");

  return useQuery({
    queryKey: ["block-times", key],
    enabled: unique.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const missing = unique.filter(k => !blockTimes.has(k));
      for (let i = 0; i < missing.length; i += 20) {
        await Promise.all(
          missing.slice(i, i + 20).map(async k => {
            const [chainId, block] = k.split(":");
            const client = getPublicClient(config, { chainId: Number(chainId) });
            if (!client) return;
            const blk = await client.getBlock({ blockNumber: BigInt(block) });
            blockTimes.set(k, Number(blk.timestamp));
          }),
        );
      }
      const out: Record<string, number> = {};
      unique.forEach(k => (out[k] = blockTimes.get(k) ?? 0));
      return out;
    },
  });
}

/* ----------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

export function normalise(chainId: number, id: number, r: any): Initiative {
  return {
    id,
    chainId,
    uid: uidOf(chainId, id),
    token: r.token,
    grantee: r.grantee,
    proposer: r.proposer,
    goal: r.goal,
    raised: r.raised,
    released: r.released,
    refundPool: r.refundPool,
    fundingDeadline: Number(r.fundingDeadline),
    selectionDeadline: Number(r.selectionDeadline),
    lastActivity: Number(r.lastActivity),
    reviewStartedAt: Number(r.reviewStartedAt),
    backers: Number(r.backers),
    qualifyBps: Number(r.qualifyBps),
    reviewNo: Number(r.reviewNo),
    reviewerCount: Number(r.reviewerCount),
    threshold: Number(r.threshold),
    currentMilestone: Number(r.currentMilestone),
    submissionsForCurrent: Number(r.submissionsForCurrent),
    approvals: Number(r.approvals),
    rejections: Number(r.rejections),
    status: STATUS[Number(r.status)],
    phase: PHASE[Number(r.phase)],
    isRfp: r.grantee === ZERO_ADDRESS,
  };
}

type RawInitiative = { chainId: number; id: number; raw: any };

// The last good read of each network, so one slow node does not make its initiatives vanish.
const lastReads = new Map<number, RawInitiative[]>();

async function readChainInitiatives(config: any, c: PoolChain): Promise<RawInitiative[]> {
  const client = getPublicClient(config, { chainId: c.id });
  if (!client) throw new Error(`No connection to ${c.label}`);
  const count = Number(
    await client.readContract({ address: c.pools.address, abi: c.pools.abi, functionName: "initiativeCount" }),
  );
  const calls = Array.from({ length: count }, (_, k) => ({
    address: c.pools.address,
    abi: c.pools.abi,
    functionName: "getInitiative" as const,
    args: [BigInt(k + 1)] as const,
  }));
  let results: { status: string; result?: unknown }[];
  try {
    results = (await client.multicall({ contracts: calls as any, allowFailure: true })) as any;
  } catch {
    results = await Promise.all(
      calls.map(call =>
        client
          .readContract(call as any)
          .then(result => ({ status: "success", result }))
          .catch(() => ({ status: "failure" })),
      ),
    );
  }
  const out: RawInitiative[] = [];
  results.forEach((r, k) => {
    if (r.status === "success") out.push({ chainId: c.id, id: k + 1, raw: r.result });
  });
  lastReads.set(c.id, out);
  return out;
}

/** Every initiative on every network, with its on-chain state and the details emitted at creation. */
export function useListings() {
  const config = useConfig();
  const { data: events, isLoading: detailsLoading } = usePoolEvents();

  const { data: reads, isLoading: readsLoading } = useQuery({
    queryKey: ["pool-listings", POOL_CHAINS.map(c => c.id).join(",")],
    enabled: POOL_CHAINS.length > 0,
    refetchInterval: 4000,
    queryFn: async (): Promise<RawInitiative[]> => {
      const results = await Promise.allSettled(POOL_CHAINS.map(c => readChainInitiatives(config, c)));
      return results.flatMap((r, i) => {
        if (r.status === "fulfilled") return r.value;
        console.warn(`Could not read initiatives on ${POOL_CHAINS[i].label}`, r.reason);
        return lastReads.get(POOL_CHAINS[i].id) ?? [];
      });
    },
  });

  const createdRefs = useMemo<BlockRef[]>(
    () =>
      (events ?? [])
        .filter(e => e.eventName === "InitiativeCreated")
        .map(e => ({ chainId: e.chainId, block: e.blockNumber })),
    [events],
  );
  const { data: times } = useBlockTimes(createdRefs);

  const listings = useMemo<Listing[]>(() => {
    if (!reads) return [];
    return reads.map(({ chainId, id, raw }) => {
      const uid = uidOf(chainId, id);
      const base = normalise(chainId, id, raw);
      const d = eventsFor(events, "InitiativeDetails", uid)[0];
      const c = eventsFor(events, "InitiativeCreated", uid)[0];
      return {
        ...base,
        createdAt: c ? (times?.[blockKey(chainId, c.blockNumber)] ?? 0) : 0,
        category: Number(c?.args.category ?? CATEGORIES.length - 1),
        metadataURI: (d?.args.metadataURI as string) ?? "",
        reviewers: ((d?.args.reviewers as `0x${string}`[]) ?? []) as `0x${string}`[],
        plan: ((d?.args.milestoneAmounts as bigint[]) ?? []) as bigint[],
      };
    });
  }, [reads, events, times]);

  return { listings, isLoading: detailsLoading || readsLoading, count: listings.length };
}

/** Newest first. Falls back to the on-chain number when the creation time has not loaded yet. */
export const byNewest = (a: Listing, b: Listing) => b.createdAt - a.createdAt || b.id - a.id || b.chainId - a.chainId;

/* ----------------------------------------------------------------------------
 * Activity log for one initiative, built from the contract's events
 * ------------------------------------------------------------------------- */

export type ActivityItem = { key: string; time: number; text: string; block: bigint; logIndex: number };

export const safeLink = (uri: string): string | null => {
  if (uri.startsWith("https://")) return uri;
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return null;
};

export function useActivity(uid: string) {
  const { data: events } = usePoolEvents();
  const mine = useMemo(() => (events ?? []).filter(e => e.uid === uid), [events, uid]);
  const { data: stamps } = useBlockTimes(
    useMemo(() => mine.map(e => ({ chainId: e.chainId, block: e.blockNumber })), [mine]),
  );

  const data = useMemo<ActivityItem[]>(() => {
    const amt = (v: bigint) => `${fmtAmount(v)} ${TOKEN_SYMBOL}`;
    const who = (a: string) => shortAddr(a);
    const items: ActivityItem[] = [];
    for (const l of mine) {
      const a = l.args;
      let text: string | null = null;
      switch (l.eventName) {
        case "InitiativeCreated":
          text = `${who(a.proposer)} created this initiative`;
          break;
        case "Contributed":
          text = `${who(a.funder)} contributed ${amt(a.amount)}`;
          break;
        case "FundingSettled":
          text = a.proceeded
            ? `Funding closed with ${amt(a.raised)} raised. The initiative goes ahead.`
            : `Funding closed with ${amt(a.raised)} raised, below the minimum. Contributions can be refunded.`;
          break;
        case "GranteeApplied":
          text = `${who(a.candidate)} offered to deliver the work`;
          break;
        case "GranteeVote":
          text = `${who(a.reviewer)} voted for ${who(a.candidate)} as grantee`;
          break;
        case "GranteeSelected":
          text = `${who(a.grantee)} was chosen as grantee`;
          break;
        case "MilestoneSubmitted":
          text = `Milestone ${Number(a.milestone) + 1} submitted for review`;
          break;
        case "ReviewVote":
          text = `${who(a.reviewer)} voted to ${a.approve ? "approve" : "reject"} milestone ${Number(a.milestone) + 1}`;
          break;
        case "MilestoneApproved":
          text = `Milestone ${Number(a.milestone) + 1} approved. ${amt(a.amount)} credited to the grantee.`;
          break;
        case "MilestoneRejected":
          text = a.lapsed
            ? `Review of milestone ${Number(a.milestone) + 1} ended with no decision and counts as a rejection`
            : `Milestone ${Number(a.milestone) + 1} was rejected`;
          break;
        case "InitiativeCompleted":
          text = "All milestones approved. The initiative is complete.";
          break;
        case "InitiativeFailed":
          text = `The initiative failed. ${amt(a.refundPool)} is available to refund.`;
          break;
        case "InitiativeCancelled":
          text = `The initiative was cancelled for inactivity. ${amt(a.refundPool)} is available to refund.`;
          break;
        case "Refunded":
          text = `${who(a.funder)} claimed a refund of ${amt(a.amount)}`;
          break;
        default:
          break;
      }
      if (text)
        items.push({
          key: `${l.transactionHash}-${l.logIndex}`,
          time: stamps?.[blockKey(l.chainId, l.blockNumber)] ?? 0,
          text,
          block: l.blockNumber,
          logIndex: l.logIndex,
        });
    }
    return items.sort((x, y) => (x.block === y.block ? y.logIndex - x.logIndex : x.block > y.block ? -1 : 1));
  }, [mine, stamps]);

  return { data, isLoading: !events };
}
