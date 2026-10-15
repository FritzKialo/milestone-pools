"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { NextPage } from "next";
import { InitiativeCard } from "~~/components/pools/InitiativeCard";
import { CATEGORIES, type Listing, isClosedBad, isQualified, loadMetadata } from "~~/lib/pools";
import { useListings } from "~~/lib/pools";

type StatusFilter = "all" | "funding" | "active" | "completed" | "closed";
type Sort = "newest" | "ending" | "funded" | "backers";

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

const Explore: NextPage = () => {
  const { listings, isLoading } = useListings();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<number | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [onlyQualified, setOnlyQualified] = useState(false);

  // Titles live in metadata, so search needs them loaded. Cached per URI by react-query.
  const { data: titles } = useQuery({
    queryKey: ["explore-titles", listings.map(l => `${l.id}:${l.metadataURI.length}`).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        listings.map(async l => {
          const m = await loadMetadata(l.metadataURI, `Initiative #${l.id}`);
          return [l.id, `${m.title} ${m.summary}`.toLowerCase()] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<number, string>;
    },
    enabled: listings.length > 0,
  });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = listings.filter(
      l =>
        matchesStatus(l, status) &&
        (category === "all" || l.category === category) &&
        (!onlyQualified || (l.status === "Funding" && isQualified(l))) &&
        (!q || (titles?.[l.id] ?? "").includes(q)),
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
    };
    return [...filtered].sort(sorters[sort]);
  }, [listings, titles, query, category, status, sort, onlyQualified]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Explore</h1>
          <p className="opacity-70 mt-1">Every initiative, read straight from the contract.</p>
        </div>
        <Link href="/create" className="btn btn-primary">
          Start an initiative
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] mb-4">
        <input
          className="input input-bordered w-full"
          placeholder="Search by title or summary"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search"
        />
        <select
          className="select select-bordered"
          value={category}
          onChange={e => setCategory(e.target.value === "all" ? "all" : Number(e.target.value))}
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c, i) => (
            <option key={c} value={i}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered"
          value={sort}
          onChange={e => setSort(e.target.value as Sort)}
          aria-label="Sort"
        >
          <option value="newest">Newest</option>
          <option value="ending">Ending soon</option>
          <option value="funded">Most funded</option>
          <option value="backers">Most backers</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${status === f.key ? "btn-neutral" : "btn-ghost border border-base-300"}`}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
        <label className="label cursor-pointer gap-2 ml-auto text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={onlyQualified}
            onChange={e => setOnlyQualified(e.target.checked)}
          />
          Already past the minimum
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : shown.length === 0 ? (
        <div className="border border-dashed border-base-300 p-10 text-center">
          <p className="font-medium">
            {listings.length === 0 ? "No initiatives yet." : "Nothing matches those filters."}
          </p>
          {listings.length === 0 && (
            <Link href="/create" className="btn btn-primary btn-sm mt-4">
              Create the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(l => (
            <InitiativeCard key={l.id} item={l} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Explore;
