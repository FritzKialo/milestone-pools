"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { BarList, type BarRow, ColumnChart, Donut, StepChart } from "~~/components/pools/Charts";
import { FeedList } from "~~/components/pools/FeedList";
import { Leaderboards } from "~~/components/pools/Leaderboards";
import { MULTI_CHAIN, POOL_CHAINS, initiativePath } from "~~/lib/chains";
import { downloadCsv } from "~~/lib/csv";
import { type FeedKind, describeEvent, useFeed, useTitleMap } from "~~/lib/feed";
import { CATEGORIES, STATUS, TOKEN_SYMBOL, fmtAmount, useListings, useNow, usePoolEvents } from "~~/lib/pools";
import {
  cumulative,
  dailyContributions,
  sumEvents,
  topBackers,
  topCreators,
  topGrantees,
  topReviewers,
  useContributions,
  voteSplit,
} from "~~/lib/stats";

const FEED_FILTERS: { key: string; label: string; kinds?: FeedKind[] }[] = [
  { key: "all", label: "Everything" },
  { key: "funding", label: "Funding", kinds: ["created", "funded", "refund"] },
  { key: "reviews", label: "Reviews", kinds: ["work", "review"] },
  { key: "payouts", label: "Payouts and endings", kinds: ["paid", "finished", "ended"] },
];

const Stat = ({ value, label, note }: { value: string; label: string; note?: string }) => (
  <div className="surface tile p-5">
    <div className="text-2xl font-semibold tabular sm:text-3xl">{value}</div>
    <div className="mt-1 text-sm opacity-70">{label}</div>
    {note && <div className="mt-0.5 text-xs opacity-50">{note}</div>}
  </div>
);

const Panel = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="surface space-y-4 p-5 sm:p-6">
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-sm opacity-60">{note}</p>}
    </div>
    {children}
  </section>
);

const Stats: NextPage = () => {
  const { listings, isLoading } = useListings();
  const { data: events } = usePoolEvents();
  const { data: contributions } = useContributions();
  const title = useTitleMap();
  const now = useNow(60_000);
  const [feedFilter, setFeedFilter] = useState("all");
  const activeFilter = FEED_FILTERS.find(f => f.key === feedFilter) ?? FEED_FILTERS[0];
  const { items: feed } = useFeed(25, activeFilter.kinds);

  const pooled = sumEvents(events, "Contributed", "amount");
  const paid = listings.reduce((s, l) => s + l.released, 0n);
  const refunded = sumEvents(events, "Refunded", "amount");
  const series = useMemo(() => cumulative(contributions), [contributions]);
  const backers = useMemo(() => topBackers(contributions, 8), [contributions]);
  const reviewers = useMemo(() => topReviewers(events, listings, 8), [events, listings]);
  const creators = useMemo(() => topCreators(listings, 8), [listings]);
  const grantees = useMemo(() => topGrantees(events, 8), [events]);
  const uniqueBackers = useMemo(() => new Set(contributions.map(c => c.funder.toLowerCase())).size, [contributions]);
  const daily = useMemo(() => dailyContributions(contributions, now, 14), [contributions, now]);
  const votes = useMemo(() => voteSplit(events), [events]);

  const by = (name: (typeof STATUS)[number]) => listings.filter(l => l.status === name).length;
  const finished = by("Completed") + by("Failed") + by("Cancelled");
  const inProgress = by("Active") + by("Selecting") + by("Funding");
  const totalVotes = votes.approve + votes.reject;
  const average = contributions.length > 0 ? pooled / BigInt(contributions.length) : 0n;
  const largest = contributions.reduce((m, c) => (c.amount > m ? c.amount : m), 0n);

  const categoryRows: BarRow[] = CATEGORIES.map((c, i) => {
    const n = listings.filter(l => l.category === i).length;
    return { label: c, value: n, display: `${n}`, href: n > 0 ? `/explore?category=${i}` : undefined };
  }).filter(r => r.value > 0);

  const raisedByCategory: BarRow[] = CATEGORIES.map((c, i) => {
    const sum = listings.filter(l => l.category === i).reduce((s, l) => s + l.raised, 0n);
    return { label: c, value: Number(sum), display: `${fmtAmount(sum, 0)} ${TOKEN_SYMBOL}` };
  })
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const networkRows: BarRow[] = POOL_CHAINS.map(c => {
    const here = listings.filter(l => l.chainId === c.id);
    const raised = here.reduce((s, l) => s + l.raised, 0n);
    return {
      label: c.label,
      value: Number(raised),
      display: `${fmtAmount(raised)} ${TOKEN_SYMBOL} in ${here.length} ${here.length === 1 ? "initiative" : "initiatives"}`,
    };
  });

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
      label: title(l.uid),
      value: Number(l.raised),
      display: `${fmtAmount(l.raised)} ${TOKEN_SYMBOL}`,
      href: initiativePath(l),
    }));

  const exportEvents = () =>
    downloadCsv("milestone-pools-events.csv", [
      ["network", "block", "transaction", "event", "initiative", "summary"],
      ...(events ?? []).map(e => [
        POOL_CHAINS.find(c => c.id === e.chainId)?.label ?? e.chainId,
        e.blockNumber.toString(),
        e.transactionHash,
        e.eventName,
        e.args?.id !== undefined ? Number(e.args.id) : "",
        describeEvent(e, title),
      ]),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            Platform stats <span className="live-dot" aria-hidden="true" />
          </h1>
          <p className="opacity-70">Live numbers computed from the contract&apos;s own records.</p>
        </div>
        <button className="btn btn-sm border-base-300 bg-base-100" onClick={exportEvents} disabled={!events?.length}>
          <ArrowDownTrayIcon className="h-4 w-4" />
          Download event log (CSV)
        </button>
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
            <Stat
              value={`${fmtAmount(average, 0)}`}
              label={`${TOKEN_SYMBOL} average contribution`}
              note={largest > 0n ? `Largest: ${fmtAmount(largest, 0)} ${TOKEN_SYMBOL}` : undefined}
            />
            <Stat value={inProgress.toString()} label="Open or in progress" />
            <Stat
              value={finished > 0 ? `${Math.round((by("Completed") / finished) * 100)}%` : "-"}
              label="Finished successfully"
              note={finished > 0 ? `${by("Completed")} of ${finished} that ended` : "Nothing has ended yet"}
            />
          </section>

          <Panel title="Total contributed over time" note="Each step is one contribution.">
            <StepChart points={series} label={`Total contributed in ${TOKEN_SYMBOL} over time`} />
          </Panel>

          <section className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Panel
                title="Contributions per day"
                note={`The last 14 days, in ${TOKEN_SYMBOL}. Hover or focus a column for details.`}
              >
                <ColumnChart
                  label="Contributions per day over the last 14 days"
                  empty="No contributions in the last 14 days."
                  columns={daily.map(d => ({
                    label: d.label,
                    value: d.total,
                    note: `${d.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${TOKEN_SYMBOL} from ${d.count} ${d.count === 1 ? "contribution" : "contributions"}`,
                  }))}
                />
              </Panel>
            </div>
            <div className="lg:col-span-2">
              <Panel title="How reviewers vote" note="Every vote cast on milestone submissions.">
                <Donut
                  label="Share of review votes that approve"
                  empty="No review votes yet."
                  center={totalVotes > 0 ? `${Math.round((votes.approve / totalVotes) * 100)}%` : "-"}
                  sub="approve"
                  parts={[
                    { label: "approve", value: votes.approve, stroke: "stroke-success", dot: "bg-success" },
                    { label: "reject", value: votes.reject, stroke: "stroke-error", dot: "bg-error" },
                  ]}
                />
              </Panel>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            {MULTI_CHAIN && (
              <Panel title="Raised by network" note="Each network has its own contract and its own funds.">
                <BarList rows={networkRows} tone="bg-primary/75" empty="No initiatives yet." />
              </Panel>
            )}
            <Panel title="Initiatives by category">
              <BarList rows={categoryRows} tone="bg-primary/75" empty="No initiatives yet." />
            </Panel>
            <Panel title="Amount raised by category" note={`In ${TOKEN_SYMBOL}`}>
              <BarList rows={raisedByCategory} tone="bg-accent/80" empty="Nothing has been contributed yet." />
            </Panel>
            <Panel title="Initiatives by status">
              <BarList rows={statusRows} tone="bg-primary/75" empty="No initiatives yet." />
            </Panel>
            <Panel title="Most funded">
              <BarList rows={topRows} empty="Nothing has been contributed yet." />
            </Panel>
          </section>

          <Panel title="Leaderboards" note="Every wallet opens its profile page.">
            <Leaderboards backers={backers} reviewers={reviewers} creators={creators} grantees={grantees} />
          </Panel>

          <Panel title="Activity feed" note="Newest first. Updates by itself every few seconds.">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter the feed">
              {FEED_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`btn btn-sm ${feedFilter === f.key ? "btn-primary" : "border-base-300 bg-base-100 hover:bg-base-200"}`}
                  aria-pressed={feedFilter === f.key}
                  onClick={() => setFeedFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <FeedList
              items={feed}
              empty={
                <>
                  Nothing here yet.{" "}
                  <Link href="/create" className="link">
                    Start the first initiative.
                  </Link>
                </>
              }
            />
          </Panel>
        </>
      )}
    </div>
  );
};

export default Stats;
