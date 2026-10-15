"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { CategoryIcon } from "~~/components/pools/Cover";
import { FundingBar } from "~~/components/pools/FundingBar";
import { InitiativeCard } from "~~/components/pools/InitiativeCard";
import { useDismissed } from "~~/lib/local";
import { CATEGORIES, DAY, TOKEN_SYMBOL, fmtAmount, useListings, useNow } from "~~/lib/pools";
import { useContributions } from "~~/lib/stats";

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

const SAMPLE_PLAN = [3000000000n, 4000000000n, 3000000000n];

const Home: NextPage = () => {
  const { listings } = useListings();
  const { data: contributions } = useContributions();
  const now = useNow(60_000);
  const intro = useDismissed("home-intro");

  const raised = listings.reduce((s, l) => s + l.raised, 0n);
  const paid = listings.reduce((s, l) => s + l.released, 0n);
  const backers = listings.reduce((s, l) => s + l.backers, 0);

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
    <div className="mx-auto w-full max-w-6xl space-y-20 px-4 py-10 sm:py-14">
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

      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Fund work in steps. Pay only for what is delivered.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed opacity-80">
            Contributions are held by a smart contract that nobody controls. A review committee, fixed from the start,
            approves each milestone before it is paid. If the work stalls, what has not been paid out can be refunded.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/explore" className="btn btn-primary btn-lg">
              Explore initiatives
            </Link>
            <Link href="/create" className="btn btn-lg border-base-300 bg-base-100">
              Start one
            </Link>
          </div>
          <p className="max-w-xl text-sm opacity-60">
            Unaudited software. Reviewers are people, and a dishonest majority can release money for work that was not
            done.
          </p>
        </div>

        <div className="surface space-y-5 p-6 shadow-sm" aria-label="Example of how a pool pays out">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Example: community workshop series</span>
            <span className="opacity-60">Sample</span>
          </div>
          <FundingBar
            raised={8_000_000_000n}
            goal={10_000_000_000n}
            qualifyBps={5000}
            plan={SAMPLE_PLAN}
            status="Active"
            currentMilestone={1}
            phase="UnderReview"
          />
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="h-2.5 w-8 rounded-full bg-success" />
              <span>
                <strong>Milestone 1</strong> approved, 3,000 {TOKEN_SYMBOL} paid
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="h-2.5 w-8 rounded-full bg-warning" />
              <span>
                <strong>Milestone 2</strong> under review, 2 of 3 approvals needed
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="h-2.5 w-8 rounded-full bg-success/20" />
              <span>
                <strong>Milestone 3</strong> waits until milestone 2 is approved
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="surface grid grid-cols-2 divide-x divide-y divide-base-300 text-center sm:grid-cols-4 sm:divide-y-0">
        {[
          { v: listings.length.toString(), l: "initiatives" },
          { v: `${fmtAmount(raised, 0)}`, l: `${TOKEN_SYMBOL} pooled` },
          { v: `${fmtAmount(paid, 0)}`, l: `${TOKEN_SYMBOL} paid for approved work` },
          { v: backers.toString(), l: "backers across all initiatives" },
        ].map(s => (
          <div key={s.l} className="p-5">
            <div className="text-2xl font-semibold tabular sm:text-3xl">{s.v}</div>
            <div className="mt-1 text-sm opacity-60">{s.l}</div>
          </div>
        ))}
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
