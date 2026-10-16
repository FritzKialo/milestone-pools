"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { CountUp } from "~~/components/pools/CountUp";
import { CategoryIcon } from "~~/components/pools/Cover";
import { FeedList } from "~~/components/pools/FeedList";
import { InitiativeCard } from "~~/components/pools/InitiativeCard";
import { LiveTicker } from "~~/components/pools/LiveTicker";
import { PeopleStrip } from "~~/components/pools/PeopleStrip";
import { useFeed } from "~~/lib/feed";
import { useDismissed } from "~~/lib/local";
import {
  CATEGORIES,
  DAY,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  fmtAmount,
  useListings,
  useNow,
  usePoolEvents,
} from "~~/lib/pools";
import { sumEvents, topBackers, topReviewers, useContributions } from "~~/lib/stats";

const STEPS = [
  {
    title: "Propose",
    text: "Set the milestones, the amounts and a review committee of 3 to 9 people. After that, nothing can be changed, not even by you.",
  },
  {
    title: "Pool",
    text: "Anyone can contribute during the funding period. If the minimum is not reached, everyone is refunded in full.",
  },
  {
    title: "Deliver",
    text: "The grantee submits evidence for one milestone at a time. A majority of the committee must approve before that part is paid.",
  },
  {
    title: "Finish or refund",
    text: "If a milestone is rejected three times, or the grantee goes silent for 60 days, what has not been paid out goes back to backers.",
  },
];

const GUARANTEES = [
  {
    title: "What the contract enforces",
    items: [
      "Money is only released after a majority of the fixed committee approves.",
      "Nobody can change the milestones, the amounts or the committee after creation.",
      "There is no owner, admin or pause button that could move your funds.",
      "If the work stalls or fails, the part not yet paid out can be refunded.",
    ],
  },
  {
    title: "What it cannot do",
    items: [
      "It cannot tell whether the work was actually good. The committee judges that.",
      "A dishonest majority of the committee can release money for work that was not done.",
      "Part already paid out for approved milestones is not refunded.",
      "It is unaudited software, so a bug could lose funds.",
    ],
  },
];

const Home: NextPage = () => {
  const { listings } = useListings();
  const { data: contributions } = useContributions();
  const { data: events } = usePoolEvents();
  const now = useNow(60_000);
  const intro = useDismissed("home-intro");
  const { items: feed } = useFeed(6);

  const pooled = sumEvents(events, "Contributed", "amount");
  const refunded = sumEvents(events, "Refunded", "amount");
  const paid = listings.reduce((s, l) => s + l.released, 0n);
  const uniqueBackers = useMemo(() => new Set(contributions.map(c => c.funder.toLowerCase())).size, [contributions]);
  const leaders = useMemo(() => topBackers(contributions, 6), [contributions]);
  const reviewerBoard = useMemo(() => topReviewers(events, listings, 6), [events, listings]);

  const stages = useMemo(() => {
    const n = (f: (l: (typeof listings)[number]) => boolean) => listings.filter(f).length;
    return [
      { label: "Open for funding", n: n(l => l.status === "Funding"), tone: "bg-info" },
      { label: "In progress", n: n(l => l.status === "Active" || l.status === "Selecting"), tone: "bg-success" },
      { label: "Completed", n: n(l => l.status === "Completed"), tone: "bg-primary" },
      { label: "Ended early", n: n(l => l.status === "Failed" || l.status === "Cancelled"), tone: "bg-error" },
    ];
  }, [listings]);

  const closingSoon = useMemo(
    () =>
      listings
        .filter(l => l.status === "Funding" && l.fundingDeadline > now)
        .sort((a, b) => a.fundingDeadline - b.fundingDeadline)
        .slice(0, 3),
    [listings, now],
  );

  const trending = useMemo(() => {
    const since = now - 7 * DAY;
    const counts = new Map<number, number>();
    contributions.filter(c => c.time >= since).forEach(c => counts.set(c.id, (counts.get(c.id) ?? 0) + 1));
    const shownAbove = new Set(closingSoon.map(l => l.id));
    return listings
      .filter(l => counts.has(l.id) && !shownAbove.has(l.id))
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
      .slice(0, 3);
  }, [contributions, listings, now, closingSoon]);

  const categoryCounts = useMemo(() => {
    const m = new Map<number, number>();
    listings.forEach(l => m.set(l.category, (m.get(l.category) ?? 0) + 1));
    return m;
  }, [listings]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-6 sm:space-y-20 sm:py-10">
      <div className="space-y-4 sm:space-y-6">
        {!intro.dismissed && (
          <div className="surface flex items-start justify-between gap-4 p-4 text-sm">
            <p>
              <strong>New here?</strong> Read{" "}
              <Link href="/how-it-works" className="link">
                how it works
              </Link>{" "}
              and the{" "}
              <Link href="/terms" className="link">
                risks
              </Link>{" "}
              before you contribute. It takes about three minutes.
            </p>
            <button className="btn btn-ghost btn-xs btn-circle" onClick={intro.dismiss} aria-label="Dismiss">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <LiveTicker />

        <section className="relative isolate grid items-center gap-6 pt-2 sm:pt-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          <div className="aurora" aria-hidden="true">
            <span className="aurora-blob a1" />
            <span className="aurora-blob a2" />
            <span className="aurora-blob a3" />
          </div>
          <div className="grid-bg" aria-hidden="true" />

          <div className="space-y-5 text-center lg:text-left">
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Fund work in steps. Pay only for what is delivered.
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed opacity-80 sm:text-lg lg:mx-0">
              A review committee, fixed from the start, approves each milestone before it is paid. If the work stalls,
              what has not been paid out can be refunded.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/explore" className="btn btn-primary btn-glow btn-lg">
                Explore initiatives
              </Link>
              <Link href="/create" className="btn btn-lg border-base-300 bg-base-100">
                Start one
              </Link>
            </div>
            <p className="mx-auto max-w-md text-xs opacity-60 lg:mx-0">
              Unaudited software. Reviewers are people, and a dishonest majority can release money for work that was not
              done.
            </p>
          </div>

          <div className="glass tile space-y-1 p-5 text-center sm:p-7">
            <p className="text-sm opacity-70">Pooled so far, held by the contract</p>
            <div
              className="flex flex-wrap items-baseline justify-center gap-x-3"
              aria-label={`${fmtAmount(pooled, 0)} ${TOKEN_SYMBOL}`}
            >
              <span className="gold-text tabular text-5xl font-bold leading-none tracking-tight sm:text-7xl lg:text-6xl xl:text-7xl">
                <CountUp
                  value={Number(pooled) / 10 ** TOKEN_DECIMALS}
                  format={n => n.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                />
              </span>
              <span className="text-xl font-semibold text-primary sm:text-2xl">{TOKEN_SYMBOL}</span>
            </div>
            <p className="pt-2 text-sm opacity-70">
              across {listings.length} {listings.length === 1 ? "initiative" : "initiatives"} from {uniqueBackers}{" "}
              {uniqueBackers === 1 ? "backer" : "backers"}
            </p>
          </div>
        </section>
      </div>

      <section className="glass tile space-y-6 p-5 sm:p-6" aria-label="Initiatives by stage">
        <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full" aria-hidden="true">
          {listings.length === 0 ? (
            <div className="h-full w-full rounded-full bg-base-300" />
          ) : (
            stages
              .filter(st => st.n > 0)
              .map(st => (
                <div
                  key={st.label}
                  className={`h-full rounded-full ${st.tone}`}
                  style={{ flexGrow: st.n, flexBasis: 0 }}
                />
              ))
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stages.map(st => (
            <div key={st.label}>
              <div className="flex items-center gap-2 text-sm opacity-70">
                <span className={`h-2.5 w-2.5 rounded-full ${st.tone}`} />
                {st.label}
              </div>
              <div className="text-3xl font-semibold tabular">{st.n}</div>
            </div>
          ))}
        </div>
        <dl className="grid gap-x-8 gap-y-2 border-t border-base-300 pt-4 text-sm sm:grid-cols-3">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="opacity-60">Paid for approved work</dt>
            <dd className="font-semibold tabular">
              {fmtAmount(paid, 0)} {TOKEN_SYMBOL}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="opacity-60">Refunded to backers</dt>
            <dd className="font-semibold tabular">
              {fmtAmount(refunded, 0)} {TOKEN_SYMBOL}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="opacity-60">Committee members</dt>
            <dd className="font-semibold tabular">
              {new Set(listings.flatMap(l => l.reviewers.map(r => r.toLowerCase()))).size}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="flex items-center gap-3 text-2xl font-semibold">
            Happening now
            <span className="live-dot" aria-hidden="true" />
          </h2>
          <Link href="/stats" className="link text-sm">
            All activity and stats
          </Link>
        </div>
        <div className="surface px-4 py-1 sm:px-5">
          <FeedList
            items={feed}
            empty={
              <>
                Nothing has happened yet.{" "}
                <Link href="/create" className="link">
                  Start the first initiative.
                </Link>
              </>
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">The people behind it</h2>
        <PeopleStrip backers={leaders} reviewers={reviewerBoard} />
      </section>

      {closingSoon.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Closing soon</h2>
            <Link href="/explore" className="link text-sm">
              See all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {closingSoon.map(l => (
              <InitiativeCard key={l.id} item={l} />
            ))}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Trending this week</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map(l => (
              <InitiativeCard key={l.id} item={l} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold">Browse by category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <Link
              key={c}
              href={`/explore?category=${i}`}
              className="surface flex items-center gap-3 p-4 transition-colors hover:border-base-content/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-200">
                <CategoryIcon category={i} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{c}</span>
                <span className="block text-xs opacity-60">
                  {categoryCounts.get(i) ?? 0} {(categoryCounts.get(i) ?? 0) === 1 ? "initiative" : "initiatives"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold">See how a pool pays out</h2>
          <p className="max-w-md opacity-80">
            Each segment of the bar is one milestone. It fills as people contribute, then turns green as the committee
            approves the work, one milestone at a time.
          </p>
        </div>
        <div className="glass space-y-4 p-6" aria-label="How to read a funding bar">
          <p className="text-sm font-medium">Reading the bar on every initiative</p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="h-2.5 w-8 shrink-0 rounded-full bg-success" />
              <span>
                <strong>Paid</strong>: the committee approved the milestone and the money was released.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="h-2.5 w-8 shrink-0 rounded-full bg-warning" />
              <span>
                <strong>Under review</strong>: the grantee submitted evidence and reviewers are voting.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="h-2.5 w-8 shrink-0 rounded-full bg-success/20" />
              <span>
                <strong>Waiting</strong>: opens once the milestone before it is approved.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <Link href="/how-it-works" className="link text-sm">
            The full walkthrough
          </Link>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="surface space-y-2 p-5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-content">
                {i + 1}
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed opacity-80">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">What you can and cannot rely on</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {GUARANTEES.map(g => (
            <div key={g.title} className="surface p-6">
              <h3 className="mb-3 text-lg font-semibold">{g.title}</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed opacity-85">
                {g.items.map(t => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm opacity-70">
          More detail in the{" "}
          <Link href="/terms" className="link">
            Terms &amp; Risks
          </Link>{" "}
          and the{" "}
          <Link href="/faq" className="link">
            FAQ
          </Link>
          .
        </p>
      </section>
    </div>
  );
};

export default Home;
