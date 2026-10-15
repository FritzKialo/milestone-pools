"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { InitiativeCard } from "~~/components/pools/InitiativeCard";
import { TOKEN_SYMBOL, fmtAmount, useListings } from "~~/lib/pools";

const STEPS = [
  {
    title: "Propose",
    text: "Set the milestones, the amounts and a review committee of 3 to 9 people. After that, nothing can be changed, not even by you.",
  },
  {
    title: "Pool",
    text: "Anyone can contribute during the funding period. Below the minimum you set, everyone is refunded in full.",
  },
  {
    title: "Deliver",
    text: "The grantee submits evidence for one milestone at a time. A majority of the committee must approve before that part is paid.",
  },
  {
    title: "Finish or refund",
    text: "If milestones are rejected three times, or the grantee goes silent for 60 days, the money not yet paid out goes back to backers.",
  },
];

const Home: NextPage = () => {
  const { listings } = useListings();
  const raised = listings.reduce((s, l) => s + l.raised, 0n);
  const paid = listings.reduce((s, l) => s + l.released, 0n);
  const recent = [...listings].sort((a, b) => b.id - a.id).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 space-y-16">
      <section className="max-w-3xl space-y-5">
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
          Fund work in steps, and pay only for what is delivered.
        </h1>
        <p className="text-lg opacity-80">
          Milestone Pools holds contributions in a contract that nobody controls. A fixed committee of reviewers
          approves each milestone before it is paid. If the work stalls, what has not been paid out can be refunded.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/explore" className="btn btn-primary btn-lg">
            Explore initiatives
          </Link>
          <Link href="/create" className="btn btn-outline btn-lg">
            Start one
          </Link>
        </div>
        <p className="text-sm opacity-60">
          Unaudited software. Reviewers are people, and a dishonest majority can release money for work that was not
          done.{" "}
          <Link href="/terms" className="link">
            Read the risks
          </Link>{" "}
          before you contribute.
        </p>
      </section>

      <section className="grid grid-cols-3 border border-base-300 divide-x divide-base-300 text-center">
        <div className="p-5">
          <div className="text-2xl sm:text-3xl font-semibold">{listings.length}</div>
          <div className="text-sm opacity-60">initiatives</div>
        </div>
        <div className="p-5">
          <div className="text-2xl sm:text-3xl font-semibold">{fmtAmount(raised, 0)}</div>
          <div className="text-sm opacity-60">{TOKEN_SYMBOL} pooled</div>
        </div>
        <div className="p-5">
          <div className="text-2xl sm:text-3xl font-semibold">{fmtAmount(paid, 0)}</div>
          <div className="text-sm opacity-60">{TOKEN_SYMBOL} paid for approved work</div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border border-base-300 p-5 space-y-2">
              <div className="text-sm opacity-60">Step {i + 1}</div>
              <h3 className="font-semibold text-lg">{s.title}</h3>
              <p className="text-sm opacity-80 leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {recent.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Latest</h2>
            <Link href="/explore" className="link text-sm">
              See all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map(l => (
              <InitiativeCard key={l.id} item={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
