"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import { ChainBadge } from "~~/components/pools/ChainBadge";
import { FundingBar } from "~~/components/pools/FundingBar";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import { MULTI_CHAIN, initiativePath, parseInitiativeRef, uidOf } from "~~/lib/chains";
import {
  CATEGORIES,
  type Listing,
  TOKEN_SYMBOL,
  fmtAmount,
  progressPct,
  shortAddr,
  timeLeft,
  useListings,
  useMetadata,
  useNow,
} from "~~/lib/pools";

const Head = ({ item }: { item: Listing }) => {
  const meta = useMetadata(item.metadataURI, item.id);
  return (
    <div className="space-y-2">
      <Link href={initiativePath(item)} className="block font-semibold leading-snug hover:text-primary">
        {meta.title}
      </Link>
      <StatusBadge status={item.status} />
    </div>
  );
};

type Row = { label: string; cell: (i: Listing, now: number) => React.ReactNode };

const ROWS: Row[] = [
  ...(MULTI_CHAIN ? [{ label: "Network", cell: (i: Listing) => <ChainBadge chainId={i.chainId} always /> }] : []),
  { label: "Category", cell: i => CATEGORIES[i.category] ?? "Other" },
  {
    label: "Raised",
    cell: i => (
      <span className="tabular">
        <strong>{fmtAmount(i.raised)}</strong> of {fmtAmount(i.goal)} {TOKEN_SYMBOL}
      </span>
    ),
  },
  {
    label: "Progress",
    cell: i => (
      <div className="space-y-1.5">
        <FundingBar
          raised={i.raised}
          goal={i.goal}
          qualifyBps={i.qualifyBps}
          plan={i.plan}
          status={i.status}
          currentMilestone={i.currentMilestone}
          phase={i.phase}
          compact
        />
        <span className="text-xs tabular opacity-70">{progressPct(i.raised, i.goal).toFixed(0)}% of goal</span>
      </div>
    ),
  },
  { label: "Backers", cell: i => <span className="tabular">{i.backers}</span> },
  {
    label: "Minimum to go ahead",
    cell: i => (
      <span className="tabular">
        {i.qualifyBps / 100}% ({fmtAmount((i.goal * BigInt(i.qualifyBps)) / 10_000n, 0)} {TOKEN_SYMBOL})
      </span>
    ),
  },
  {
    label: "Milestones",
    cell: i => {
      const first = i.goal > 0n && i.plan[0] ? Number((i.plan[0] * 1000n) / i.goal) / 10 : 0;
      return (
        <span className="tabular">
          {i.plan.length}, first pays {first}%
        </span>
      );
    },
  },
  {
    label: "Committee",
    cell: i => (
      <span className="tabular">
        {i.threshold} of {i.reviewerCount} must approve
      </span>
    ),
  },
  {
    label: "Grantee",
    cell: i =>
      i.isRfp ? (
        "Open call"
      ) : (
        <Link href={`/profile/${i.grantee}`} className="font-mono hover:text-primary">
          {shortAddr(i.grantee)}
        </Link>
      ),
  },
  {
    label: "Created by",
    cell: i => (
      <Link href={`/profile/${i.proposer}`} className="font-mono hover:text-primary">
        {shortAddr(i.proposer)}
      </Link>
    ),
  },
  {
    label: "Next date",
    cell: (i, now) =>
      i.status === "Funding"
        ? `Funding: ${timeLeft(i.fundingDeadline, now)}`
        : i.status === "Active"
          ? `Milestone ${Math.min(i.currentMilestone + 1, i.plan.length)} of ${i.plan.length}`
          : "-",
  },
  {
    label: "Paid out so far",
    cell: i => (
      <span className="tabular">
        {fmtAmount(i.released)} {TOKEN_SYMBOL}
      </span>
    ),
  },
];

const CompareInner = () => {
  const params = useSearchParams();
  const { listings, isLoading } = useListings();
  const now = useNow(30_000);

  const uids = useMemo(() => {
    const refs = (params.get("ids") ?? "")
      .split(",")
      .map(s => parseInitiativeRef(s.trim()))
      .filter((r): r is { chainId: number; id: number } => !!r)
      .map(r => uidOf(r.chainId, r.id));
    return Array.from(new Set(refs)).slice(0, 3);
  }, [params]);

  const items = uids.map(uid => listings.find(l => l.uid === uid)).filter((l): l is Listing => !!l);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
      <div className="space-y-1">
        <Link href="/explore" className="link text-sm opacity-70">
          &larr; Back to Explore
        </Link>
        <h1 className="text-3xl font-bold">Compare initiatives</h1>
        <p className="opacity-70">Side by side, from the contract&apos;s own records.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : items.length < 2 ? (
        <div className="surface border-dashed p-10 text-center">
          <p className="font-medium">Pick at least two initiatives to compare.</p>
          <p className="mx-auto mt-1 max-w-md text-sm opacity-70">
            On Explore, press Compare, tick two or three initiatives, then open the comparison.
          </p>
          <Link href="/explore" className="btn btn-primary btn-sm mt-4">
            Go to Explore
          </Link>
        </div>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-base-300 align-top">
                <th scope="col" className="sticky left-0 z-10 w-36 bg-base-100 p-4 text-left font-medium opacity-60">
                  <span className="sr-only">Detail</span>
                </th>
                {items.map(i => (
                  <th key={i.uid} scope="col" className="p-4 text-left font-normal">
                    <Head item={i} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {ROWS.map(r => (
                <tr key={r.label} className="align-top">
                  <th scope="row" className="sticky left-0 z-10 bg-base-100 p-4 text-left font-medium opacity-70">
                    {r.label}
                  </th>
                  {items.map(i => (
                    <td key={i.uid} className="p-4">
                      {r.cell(i, now)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-base-100 p-4">
                  <span className="sr-only">Open</span>
                </th>
                {items.map(i => (
                  <td key={i.uid} className="p-4">
                    <Link href={initiativePath(i)} className="btn btn-sm btn-primary">
                      Open
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Compare: NextPage = () => (
  <Suspense
    fallback={
      <div className="flex justify-center py-24">
        <span className="loading loading-spinner loading-lg" />
      </div>
    }
  >
    <CompareInner />
  </Suspense>
);

export default Compare;
