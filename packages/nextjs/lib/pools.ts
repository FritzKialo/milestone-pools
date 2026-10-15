"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseEventLogs, parseUnits } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

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
  id: number;
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

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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

  args: any;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: string;
};

export function usePoolEvents() {
  const { data: info } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const client = usePublicClient();
  return useQuery({
    queryKey: ["pool-events", info?.address],
    enabled: !!info && !!client,
    refetchInterval: 5000,
    queryFn: async (): Promise<PoolEvent[]> => {
      if (!info || !client) return [];
      const logs = await client.getLogs({
        address: info.address,
        fromBlock: BigInt(info.deployedOnBlock ?? 0),
        toBlock: "latest",
      });

      const parsed = parseEventLogs({ abi: info.abi as any, logs }) as any[];
      return parsed.map(l => ({
        eventName: l.eventName as string,
        args: l.args,
        blockNumber: l.blockNumber as bigint,
        logIndex: Number(l.logIndex),
        transactionHash: l.transactionHash as string,
      }));
    },
  });
}

export const eventsFor = (events: PoolEvent[] | undefined, name: string, id: number) =>
  (events ?? []).filter(e => e.eventName === name && e.args?.id !== undefined && Number(e.args.id) === id);

/* ----------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

export function normalise(id: number, r: any): Initiative {
  return {
    id,
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

/** Every initiative with its on-chain state and the details emitted at creation. */
export function useListings() {
  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const { data: count, isLoading: countLoading } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "initiativeCount",
    watch: true,
  });
  const n = Number(count ?? 0n);

  const { data: events, isLoading: detailsLoading } = usePoolEvents();

  const contracts = useMemo(
    () =>
      pools
        ? Array.from({ length: n }, (_, k) => ({
            address: pools.address,
            abi: pools.abi,
            functionName: "getInitiative" as const,
            args: [BigInt(k + 1)] as const,
          }))
        : [],
    [pools, n],
  );

  const { data: reads, isLoading: readsLoading } = useReadContracts({
    contracts: contracts as any,
    query: { enabled: contracts.length > 0, refetchInterval: 4000 },
  });

  const listings = useMemo<Listing[]>(() => {
    if (!reads) return [];
    const out: Listing[] = [];
    reads.forEach((r, k) => {
      if (r.status !== "success") return;
      const id = k + 1;
      const base = normalise(id, r.result);
      const d = eventsFor(events, "InitiativeDetails", id)[0];
      const c = eventsFor(events, "InitiativeCreated", id)[0];
      out.push({
        ...base,
        category: Number(c?.args.category ?? CATEGORIES.length - 1),
        metadataURI: (d?.args.metadataURI as string) ?? "",
        reviewers: ((d?.args.reviewers as `0x${string}`[]) ?? []) as `0x${string}`[],
        plan: ((d?.args.milestoneAmounts as bigint[]) ?? []) as bigint[],
      });
    });
    return out;
  }, [reads, events]);

  return { listings, isLoading: countLoading || detailsLoading || (n > 0 && readsLoading), count: n };
}

/* ----------------------------------------------------------------------------
 * Activity log for one initiative, built from the contract's events
 * ------------------------------------------------------------------------- */

export type ActivityItem = { key: string; time: number; text: string; block: bigint; logIndex: number };

export const safeLink = (uri: string): string | null => {
  if (uri.startsWith("https://")) return uri;
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  return null;
};

export function useActivity(id: number) {
  const client = usePublicClient();
  const { data: events } = usePoolEvents();
  const mine = useMemo(
    () => (events ?? []).filter(e => e.args && e.args.id !== undefined && Number(e.args.id) === id),
    [events, id],
  );
  const blockKey = Array.from(new Set(mine.map(e => e.blockNumber.toString()))).join(",");

  const { data: stamps } = useQuery({
    queryKey: ["pool-block-times", blockKey],
    enabled: !!client && mine.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(
        Array.from(new Set(mine.map(e => e.blockNumber))).map(async b => {
          const blk = await client!.getBlock({ blockNumber: b });
          out[b.toString()] = Number(blk.timestamp);
        }),
      );
      return out;
    },
  });

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
          time: stamps?.[l.blockNumber.toString()] ?? 0,
          text,
          block: l.blockNumber,
          logIndex: l.logIndex,
        });
    }
    return items.sort((x, y) => (x.block === y.block ? y.logIndex - x.logIndex : x.block > y.block ? -1 : 1));
  }, [mine, stamps]);

  return { data, isLoading: !events };
}
