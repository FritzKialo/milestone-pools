"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { NextPage } from "next";
import { BarList, type BarRow, StepChart } from "~~/components/pools/Charts";
import { TopBackers } from "~~/components/pools/TopBackers";
import {
  CATEGORIES,
  type Listing,
  STATUS,
  TOKEN_SYMBOL,
  fmtAmount,
  fmtDateTime,
  loadMetadata,
  shortAddr,
  useListings,
  usePoolEvents,
} from "~~/lib/pools";
import { cumulative, sumEvents, topBackers, useBlockTimes, useContributions } from "~~/lib/stats";

const useTitles = (listings: Listing[]) => {
  const { data } = useQuery({
    queryKey: ["stats-titles", listings.map(l => `${l.id}:${l.metadataURI.length}`).join(",")],
    enabled: listings.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        listings.map(async l => [l.id, (await loadMetadata(l.metadataURI, `Initiative #${l.id}`)).title] as const),
      );
      return Object.fromEntries(entries) as Record<number, string>;
    },
  });
  return (id: number) => data?.[id] ?? `Initiative #${id}`;
};

const RECENT_EVENTS = [
  "InitiativeCreated",
  "Contributed",
  "MilestoneApproved",
  "InitiativeCompleted",
  "InitiativeFailed",
  "InitiativeCancelled",
  "Refunded",
];

const Stat = ({ value, label, note }: { value: string; label: string; note?: string }) => (
  <div className="surface p-5">
    <div className="text-2xl font-semibold tabular">{value}</div>
    <div className="mt-1 text-sm opacity-70">{label}</div>
    {note && <div className="mt-0.5 text-xs opacity-50">{note}</div>}
  </div>
);

const Stats: NextPage = () => {
  const { listings, isLoading } = useListings();
  const { data: events } = usePoolEvents();
  const { data: contributions } = useContributions();
  const title = useTitles(listings);

  const pooled = sumEvents(events, "Contributed", "amount");
  const paid = listings.reduce((s, l) => s + l.released, 0n);
  const refunded = sumEvents(events, "Refunded", "amount");
  const series = useMemo(() => cumulative(contributions), [contributions]);
  const backers = useMemo(() => topBackers(contributions, 8), [contributions]);
  const uniqueBackers = useMemo(() => new Set(contributions.map(c => c.funder.toLowerCase())).size, [contributions]);

  const by = (name: (typeof STATUS)[number]) => listings.filter(l => l.status === name).length;
  const finished = by("Completed") + by("Failed") + by("Cancelled");
  const inProgress = by("Active") + by("Selecting") + by("Funding");

  const categoryRows: BarRow[] = CATEGORIES.map((c, i) => {
    const n = listings.filter(l => l.category === i).length;
    return { label: c, value: n, display: `${n}`, href: n > 0 ? `/explore?category=${i}` : undefined };
  }).filter(r => r.value > 0);

  const statusRows: BarRow[] = STATUS.map(s => ({
    label: s === "Active" ? "In progress" : s === "Selecting" ? "Choosing grantee" : s,
    value: by(s),
    display: `${by(s)}`,
  })).filter(r => r.value > 0);

  const topRows: BarRow[] = [...listings]
    .sort((a, b) => (b.raised === a.raised ? 0 : b.raised > a.raised ? 1 : -1))
    .filter(l => l.raised > 0n)
    .slice(0, 6)
    .map(l => ({
      label: title(l.id),
      value: Number(l.raised),
      display: `${fmtAmount(l.raised)} ${TOKEN_SYMBOL}`,
      href: `/initiative/${l.id}`,
    }));

  const recent = useMemo(
    () =>
      (events ?? [])
        .filter(e => RECENT_EVENTS.includes(e.eventName))
        .slice(-12)
        .reverse(),
    [events],
  );
  const { data: recentTimes } = useBlockTimes(recent.map(e => e.blockNumber));

  const describe = (e: (typeof recent)[number]) => {
    const a = e.args;
    const name = title(Number(a.id));
    switch (e.eventName) {
      case "InitiativeCreated":
        return `${shortAddr(a.proposer)} created ${name}`;
      case "Contributed":
        return `${shortAddr(a.funder)} contributed ${fmtAmount(a.amount)} ${TOKEN_SYMBOL} to ${name}`;
      case "MilestoneApproved":
        return `Milestone ${Number(a.milestone) + 1} of ${name} approved, ${fmtAmount(a.amount)} ${TOKEN_SYMBOL} paid`;
      case "InitiativeCompleted":
        return `${name} completed all milestones`;
      case "InitiativeFailed":
        return `${name} failed. Remaining funds are refundable.`;
      case "InitiativeCancelled":
        return `${name} was cancelled for inactivity`;
      case "Refunded":
        return `${shortAddr(a.funder)} claimed a ${fmtAmount(a.amount)} ${TOKEN_SYMBOL} refund from ${name}`;
      default:
        return "";
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Platform stats</h1>
        <p className="opacity-70">Live numbers computed from the contract&apos;s own records.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat value={listings.length.toString()} label="Initiatives" />
            <Stat value={`${fmtAmount(pooled, 0)}`} label={`${TOKEN_SYMBOL} ever contributed`} />
            <Stat value={`${fmtAmount(paid, 0)}`} label={`${TOKEN_SYMBOL} paid for approved work`} />
            <Stat value={`${fmtAmount(refunded, 0)}`} label={`${TOKEN_SYMBOL} refunded`} />
            <Stat value={uniqueBackers.toString()} label="Different backers" />
            <Stat value={inProgress.toString()} label="Open or in progress" />
            <Stat value={by("Completed").toString()} label="Completed" />
            <Stat
              value={finished > 0 ? `${Math.round((by("Completed") / finished) * 100)}%` : "-"}
              label="Finished successfully"
              note={finished > 0 ? `${by("Completed")} of ${finished} that ended` : "Nothing has ended yet"}
            />
          </section>

          <section className="surface space-y-3 p-6">
            <h2 className="text-xl font-semibold">Total contributed over time</h2>
            <StepChart points={series} label={`Total contributed in ${TOKEN_SYMBOL} over time`} />
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="surface space-y-4 p-6">
              <h2 className="text-xl font-semibold">Initiatives by category</h2>
              <BarList rows={categoryRows} tone="bg-primary/75" empty="No initiatives yet." />
            </div>
            <div className="surface space-y-4 p-6">
              <h2 className="text-xl font-semibold">Initiatives by status</h2>
              <BarList rows={statusRows} tone="bg-primary/75" empty="No initiatives yet." />
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="surface space-y-4 p-6">
              <h2 className="text-xl font-semibold">Most funded</h2>
              <BarList rows={topRows} empty="Nothing has been contributed yet." />
            </div>
            <div className="surface space-y-4 p-6">
              <h2 className="text-xl font-semibold">Largest backers</h2>
              <TopBackers backers={backers} total={pooled} />
            </div>
          </section>

          <section className="surface space-y-3 p-6">
            <h2 className="text-xl font-semibold">Recent activity</h2>
            {recent.length === 0 ? (
              <p className="text-sm opacity-70">
                Nothing has happened yet.{" "}
                <Link href="/create" className="link">
                  Start the first initiative.
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-base-300">
                {recent.map(e => (
                  <li
                    key={`${e.transactionHash}-${e.logIndex}`}
                    className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:justify-between"
                  >
                    <Link href={`/initiative/${Number(e.args.id)}`} className="hover:underline">
                      {describe(e)}
                    </Link>
                    <span className="shrink-0 opacity-60">
                      {recentTimes?.[e.blockNumber.toString()]
                        ? fmtDateTime(recentTimes[e.blockNumber.toString()])
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Stats;
