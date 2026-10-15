"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { ArrowDownTrayIcon, LinkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { InitiativeCard } from "~~/components/pools/InitiativeCard";
import { InitiativeTable } from "~~/components/pools/InitiativeTable";
import { CardGridSkeleton } from "~~/components/pools/Skeletons";
import { ViewToggle } from "~~/components/pools/ViewToggle";
import { downloadCsv } from "~~/lib/csv";
import { useViewMode, useWatchlist } from "~~/lib/local";
import {
  CATEGORIES,
  type Listing,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  isClosedBad,
  isQualified,
  loadMetadata,
  useListings,
} from "~~/lib/pools";
import { notification } from "~~/utils/scaffold-eth";

type StatusFilter = "all" | "funding" | "active" | "completed" | "closed";
type Sort = "newest" | "ending" | "funded" | "backers" | "goal";
type Size = "any" | "small" | "medium" | "large";

const SIZES: { key: Size; label: string; test: (goal: bigint) => boolean }[] = [
  { key: "any", label: "Any goal", test: () => true },
  { key: "small", label: "Under 1,000", test: g => g < 1_000_000_000n },
  { key: "medium", label: "1,000 to 10,000", test: g => g >= 1_000_000_000n && g <= 10_000_000_000n },
  { key: "large", label: "Over 10,000", test: g => g > 10_000_000_000n },
];
const SORTS: Sort[] = ["newest", "ending", "funded", "backers", "goal"];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "funding", label: "Open for funding" },
  { key: "active", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "closed", label: "Failed or cancelled" },
];

const matchesStatus = (i: Listing, f: StatusFilter) => {
  switch (f) {
    case "funding":
      return i.status === "Funding";
    case "active":
      return i.status === "Active" || i.status === "Selecting";
    case "completed":
      return i.status === "Completed";
    case "closed":
      return isClosedBad(i);
    default:
      return true;
  }
};

const parseCategory = (v: string | null): number | "all" => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 0 && n < CATEGORIES.length ? n : "all";
};

const ExploreInner = () => {
  const params = useSearchParams();
  const { listings, isLoading } = useListings();
  const { saved } = useWatchlist();
  const { view, setView } = useViewMode();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<number | "all">(parseCategory(params.get("category")));
  const [status, setStatus] = useState<StatusFilter>(
    STATUS_FILTERS.some(f => f.key === params.get("status")) ? (params.get("status") as StatusFilter) : "all",
  );
  const [sort, setSort] = useState<Sort>(
    SORTS.includes(params.get("sort") as Sort) ? (params.get("sort") as Sort) : "newest",
  );
  const [size, setSize] = useState<Size>(
    SIZES.some(z => z.key === params.get("size")) ? (params.get("size") as Size) : "any",
  );
  const [onlyQualified, setOnlyQualified] = useState(params.get("past") === "1");
  const [onlySaved, setOnlySaved] = useState(params.get("saved") === "1");
  const [onlyCalls, setOnlyCalls] = useState(params.get("call") === "1");
  const [onlyMine, setOnlyMine] = useState(params.get("mine") === "1");
  const { address } = useAccount();

  // Titles live in metadata, so search needs them loaded. Cached per URI by react-query.
  const { data: titles } = useQuery({
    queryKey: ["explore-titles", listings.map(l => `${l.id}:${l.metadataURI.length}`).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        listings.map(async l => {
          const m = await loadMetadata(l.metadataURI, `Initiative #${l.id}`);
          return [l.id, { title: m.title, text: `${m.title} ${m.summary}`.toLowerCase() }] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<number, { title: string; text: string }>;
    },
    enabled: listings.length > 0,
  });

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    listings.forEach(l => m.set(l.category, (m.get(l.category) ?? 0) + 1));
    return m;
  }, [listings]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = listings.filter(
      l =>
        matchesStatus(l, status) &&
        (category === "all" || l.category === category) &&
        (!onlyQualified || (l.status === "Funding" && isQualified(l))) &&
        (!onlySaved || saved.includes(l.id)) &&
        (!onlyCalls || l.isRfp) &&
        (!onlyMine || (!!address && l.proposer.toLowerCase() === address.toLowerCase())) &&
        SIZES.find(z => z.key === size)!.test(l.goal) &&
        (!q || (titles?.[l.id]?.text ?? "").includes(q)),
    );
    const sorters: Record<Sort, (a: Listing, b: Listing) => number> = {
      newest: (a, b) => b.id - a.id,
      ending: (a, b) => {
        const aOpen = a.status === "Funding" ? a.fundingDeadline : Number.MAX_SAFE_INTEGER;
        const bOpen = b.status === "Funding" ? b.fundingDeadline : Number.MAX_SAFE_INTEGER;
        return aOpen - bOpen || b.id - a.id;
      },
      funded: (a, b) => Number((b.raised * 10_000n) / (b.goal || 1n) - (a.raised * 10_000n) / (a.goal || 1n)),
      backers: (a, b) => b.backers - a.backers,
      goal: (a, b) => (b.goal === a.goal ? 0 : b.goal > a.goal ? 1 : -1),
    };
    return [...filtered].sort(sorters[sort]);
  }, [
    listings,
    titles,
    query,
    category,
    status,
    sort,
    size,
    onlyQualified,
    onlySaved,
    onlyCalls,
    onlyMine,
    address,
    saved,
  ]);

  const chip = (active: boolean) =>
    `btn btn-sm ${active ? "btn-primary" : "border-base-300 bg-base-100 hover:bg-base-200"}`;
  const filtersOn =
    query !== "" ||
    category !== "all" ||
    status !== "all" ||
    size !== "any" ||
    onlyQualified ||
    onlySaved ||
    onlyCalls ||
    onlyMine;

  // Keep the address bar in step with the filters so the page can be shared or bookmarked.
  useEffect(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (category !== "all") p.set("category", String(category));
    if (status !== "all") p.set("status", status);
    if (size !== "any") p.set("size", size);
    if (sort !== "newest") p.set("sort", sort);
    if (onlyQualified) p.set("past", "1");
    if (onlySaved) p.set("saved", "1");
    if (onlyCalls) p.set("call", "1");
    if (onlyMine) p.set("mine", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [query, category, status, size, sort, onlyQualified, onlySaved, onlyCalls, onlyMine]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notification.success("Link to these filters copied");
    } catch {
      notification.error("Could not copy. Copy the address from the browser bar instead.");
    }
  };

  const exportCsv = () =>
    downloadCsv("milestone-pools-initiatives.csv", [
      [
        "id",
        "title",
        "category",
        "status",
        `raised (${TOKEN_SYMBOL})`,
        `goal (${TOKEN_SYMBOL})`,
        "backers",
        "funding deadline",
        "proposer",
        "link",
      ],
      ...shown.map(l => [
        l.id,
        titles?.[l.id]?.title ?? `Initiative #${l.id}`,
        CATEGORIES[l.category] ?? "Other",
        l.status,
        Number(l.raised) / 10 ** TOKEN_DECIMALS,
        Number(l.goal) / 10 ** TOKEN_DECIMALS,
        l.backers,
        l.fundingDeadline ? new Date(l.fundingDeadline * 1000).toISOString() : "",
        l.proposer,
        `${window.location.origin}/initiative/${l.id}`,
      ]),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Explore</h1>
          <p className="opacity-70">Every initiative, read straight from the contract.</p>
        </div>
        <Link href="/create" className="btn btn-primary">
          Start an initiative
        </Link>
      </div>

      <div className="surface mb-6 space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="input input-bordered flex w-full items-center gap-2 bg-base-100">
            <MagnifyingGlassIcon className="h-4 w-4 opacity-60" />
            <input
              className="grow"
              placeholder="Search by title or summary"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search"
            />
          </label>
          <select
            className="select select-bordered bg-base-100"
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="ending">Ending soon</option>
            <option value="funded">Most funded</option>
            <option value="backers">Most backers</option>
            <option value="goal">Largest goal</option>
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Category">
          <button className={chip(category === "all")} onClick={() => setCategory("all")}>
            All categories
          </button>
          {CATEGORIES.map((c, i) => (
            <button key={c} className={chip(category === i)} onClick={() => setCategory(i)}>
              {c}
              <span className="opacity-60">{counts.get(i) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Status">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} className={chip(status === f.key)} onClick={() => setStatus(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Goal size">
          {SIZES.map(z => (
            <button key={z.key} className={chip(size === z.key)} onClick={() => setSize(z.key)}>
              {z.label}
            </button>
          ))}
          <span className="text-xs opacity-60">{TOKEN_SYMBOL}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={onlyQualified}
              onChange={e => setOnlyQualified(e.target.checked)}
            />
            Already past the minimum
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={onlySaved}
              onChange={e => setOnlySaved(e.target.checked)}
            />
            Saved by me ({saved.length})
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={onlyCalls}
              onChange={e => setOnlyCalls(e.target.checked)}
            />
            Open calls for a grantee
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={onlyMine}
              onChange={e => setOnlyMine(e.target.checked)}
            />
            Created by me
          </label>
          {filtersOn && (
            <button
              className="link ml-auto"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setStatus("all");
                setSize("any");
                setOnlyQualified(false);
                setOnlySaved(false);
                setOnlyCalls(false);
                setOnlyMine(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : shown.length === 0 ? (
        <div className="surface border-dashed p-12 text-center">
          <p className="font-medium">
            {listings.length === 0
              ? "No initiatives yet."
              : onlySaved && saved.length === 0
                ? "You have not saved anything yet."
                : "Nothing matches those filters."}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm opacity-70">
            {listings.length === 0
              ? "Be the first to propose one."
              : onlySaved && saved.length === 0
                ? "Press the star on a card to keep it here. Saved items live in this browser only."
                : "Try removing a filter or searching for a different word."}
          </p>
          {listings.length === 0 && (
            <Link href="/create" className="btn btn-primary btn-sm mt-4">
              Create the first one
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm opacity-60">
              {shown.length} {shown.length === 1 ? "initiative" : "initiatives"}
            </p>
            <div className="flex gap-2">
              <button className="btn btn-sm border-base-300 bg-base-100" onClick={copyLink}>
                <LinkIcon className="h-4 w-4" />
                Copy link
              </button>
              <button className="btn btn-sm border-base-300 bg-base-100" onClick={exportCsv}>
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
          {view === "table" ? (
            <InitiativeTable items={shown} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(l => (
                <InitiativeCard key={l.id} item={l} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Explore: NextPage = () => (
  <Suspense
    fallback={
      <div className="flex justify-center py-24">
        <span className="loading loading-spinner loading-lg" />
      </div>
    }
  >
    <ExploreInner />
  </Suspense>
);

export default Explore;
