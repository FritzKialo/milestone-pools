"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BanknotesIcon,
  BookOpenIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ScaleIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { FaqList } from "~~/components/pools/FaqList";
import {
  DAY,
  MAX_MILESTONES,
  MAX_REVIEWERS,
  MAX_ROUNDS,
  MIN_REVIEWERS,
  REVIEW_PERIOD,
  SUBMISSION_WINDOW,
} from "~~/lib/pools";

type Group = { id: string; title: string; blurb: string; icon: typeof BookOpenIcon; items: { q: string; a: string }[] };

const GROUPS: Group[] = [
  {
    id: "basics",
    title: "The basics",
    blurb: "What this is and who is in control.",
    icon: BookOpenIcon,
    items: [
      {
        q: "What is Milestone Pools?",
        a: "A way for a group of people to fund one piece of work together. The money is held by a smart contract and paid out in steps, only after a review committee approves each step.",
      },
      {
        q: "Who holds the money?",
        a: "The smart contract. It has no owner, no admin and no pause button. The creator, the grantee and the people who built this site cannot move your funds outside the rules.",
      },
      {
        q: "Is this a charity, an investment or a store?",
        a: "No. It is software for pooling money toward a goal. Nobody promises a return, and nobody promises the work will be delivered.",
      },
      {
        q: "Which token does it use?",
        a: "USDC. On a test network it is a free test token with no value, and you can get some from the button on an initiative page.",
      },
      {
        q: "Who are the people involved?",
        a: "Backers put money in. A creator sets the plan. A grantee does the work and gets paid. A fixed committee of reviewers approves each milestone. One wallet can play more than one part, and every wallet has a public profile page showing what it has done.",
      },
    ],
  },
  {
    id: "contributing",
    title: "Contributing",
    blurb: "Putting money in, and getting it back.",
    icon: BanknotesIcon,
    items: [
      {
        q: "How do I contribute?",
        a: "Connect a wallet, open an initiative that is still funding, enter an amount and confirm two transactions: first you allow the exact amount, then you contribute it.",
      },
      {
        q: "Why are there two transactions?",
        a: "The first one lets the contract take the exact amount you typed, and no more. The second one actually moves it into the pool. This is how every token payment on Ethereum works.",
      },
      {
        q: "Is there a minimum or maximum?",
        a: "The smallest contribution is 1 USDC. You cannot contribute more than is still needed to reach the goal.",
      },
      {
        q: "Can I get my money back?",
        a: "Yes, if the initiative misses its minimum, fails, or is cancelled. You claim the refund yourself from the initiative page or from My activity. You cannot withdraw a contribution while the initiative is going ahead normally.",
      },
      {
        q: "How much of a refund do I get?",
        a: "Your share of what has not been paid out yet, in proportion to what you contributed. Money already paid for approved milestones is not refunded. Shares are rounded down, so a few units of dust can remain in the contract.",
      },
      {
        q: "What does Saved mean?",
        a: "The star keeps an initiative in your Saved filter on Explore. It is stored in this browser only. Nobody else sees it, and it does not move to another device. You also get a small notice when something new happens on a saved initiative.",
      },
    ],
  },
  {
    id: "creating",
    title: "Creating an initiative",
    blurb: "The choices you make once, up front.",
    icon: PencilSquareIcon,
    items: [
      {
        q: "What do I decide when I create one?",
        a: "The milestones and amounts, how long funding is open, the minimum share of the goal needed to go ahead, who the grantee is (or an open call), the review committee, and how many approvals are needed per milestone.",
      },
      {
        q: "What are the limits?",
        a: `Funding stays open between 1 and 90 days. The minimum needed to go ahead is at least 10% of the goal. You can have up to ${MAX_MILESTONES} milestones and a committee of ${MIN_REVIEWERS} to ${MAX_REVIEWERS} reviewers.`,
      },
      {
        q: "Can I change it afterwards?",
        a: "No. Once created, none of it can be changed by anyone. That is what lets backers trust it.",
      },
      {
        q: "What is an open call?",
        a: "You do not name a grantee. After funding succeeds, anyone can offer to do the work and the committee votes on who. If they cannot agree within 30 days, everyone is refunded.",
      },
      {
        q: "Can I be on my own committee?",
        a: "You can, if you are not also the grantee. But backers will trust a committee that is independent of you more than one you control, so think about how it looks.",
      },
      {
        q: "Where is my description stored?",
        a: "In the blockchain record of your transaction, so anyone can read it and it cannot be edited or removed. Do not include anything private.",
      },
    ],
  },
  {
    id: "reviewing",
    title: "Reviewing and delivering",
    blurb: "How work gets approved and paid.",
    icon: ScaleIcon,
    items: [
      {
        q: "How does a milestone get paid?",
        a: `The grantee submits a link to evidence. Reviewers vote for up to ${REVIEW_PERIOD / DAY} days. When enough approve, that milestone's amount is credited to the grantee, who withdraws it when they like.`,
      },
      {
        q: "What counts as enough approvals?",
        a: "The number set at creation, which is always a majority of the committee. Once approval is no longer possible, the attempt is rejected straight away without waiting for the deadline.",
      },
      {
        q: "What if reviewers do not vote?",
        a: `After ${REVIEW_PERIOD / DAY} days anyone can close the review. A review with no decision counts as a rejection, so reviewers who stay silent work against the grantee.`,
      },
      {
        q: "How many tries does the grantee get?",
        a: `${MAX_ROUNDS} submissions for each milestone. Each approved milestone starts with ${MAX_ROUNDS} fresh tries. A third rejection fails the initiative.`,
      },
      {
        q: "What if the grantee disappears?",
        a: `After ${SUBMISSION_WINDOW / DAY} days without a submission, anyone can cancel it. The unpaid part is shared back to backers.`,
      },
    ],
  },
  {
    id: "money",
    title: "Fees, gas and networks",
    blurb: "What things cost and where they run.",
    icon: CurrencyDollarIcon,
    items: [
      {
        q: "Does the contract charge a fee?",
        a: "No. The contract takes no cut: everything contributed goes to the initiative. You do pay the network's gas fee for each transaction, and that goes to the network, not to us.",
      },
      {
        q: "Why do I need ETH as well as USDC?",
        a: "Every transaction on Ethereum costs gas, and gas is paid in ETH. USDC is only what you contribute. On a test network, free test ETH is available from a faucet.",
      },
      {
        q: "Which network is this on?",
        a: "The live demo runs on Sepolia, an Ethereum test network where nothing has real value. The header shows the network the site expects. If your wallet is on another one, the site asks you to switch.",
      },
      {
        q: "Which wallets work?",
        a: "Most popular Ethereum wallets, including browser extensions such as MetaMask and mobile wallets that use WalletConnect.",
      },
    ],
  },
  {
    id: "safety",
    title: "Safety",
    blurb: "What could go wrong, plainly.",
    icon: ShieldCheckIcon,
    items: [
      {
        q: "Has the code been audited?",
        a: "No independent audit has been done. It has an automated test suite, including randomised checks that the contract's balance always matches what it owes, and a static-analysis pass. That reduces risk but does not remove it.",
      },
      {
        q: "What is the biggest risk?",
        a: "The committee. The contract checks that a majority voted, not that the work was good. A dishonest majority can release money for work that was not done. Look at who the reviewers are before you contribute.",
      },
      {
        q: "What if there is a bug?",
        a: "Nobody can patch the deployed contract. That is deliberate, so nobody can take your funds, but it means a flaw could not be repaired.",
      },
      {
        q: "Can I check what the contract did?",
        a: "Yes. Every action is a public record. The activity feed and the stats page read from it, and you can download the full event log as a CSV from the stats page.",
      },
      {
        q: "Does anything here count as advice?",
        a: "No. Nothing on this site is legal, financial or tax advice. Rules about pooling money and digital tokens differ between countries, so check what applies to you.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    blurb: "When something does not work.",
    icon: WrenchScrewdriverIcon,
    items: [
      {
        q: "My transaction failed or was rejected.",
        a: "Read the message your wallet or the site shows. Common causes are too little ETH for gas, an amount above what the initiative still needs, funding that has already closed, or being on the wrong network. A failed transaction moves no USDC. You only lose the gas.",
      },
      {
        q: "My contribution does not show up yet.",
        a: "Wait for the transaction to confirm in your wallet. The site checks the chain every few seconds, so it usually appears within a minute. If it does not, reload the page.",
      },
      {
        q: "I cannot see my USDC balance in my wallet.",
        a: "Some wallets only list tokens you have added. Add the token by its contract address and the balance will appear.",
      },
      {
        q: "The site keeps asking me to switch network.",
        a: "Use the network button in the header, or switch inside your wallet, to the network the site shows. Contributions cannot be made from any other network.",
      },
      {
        q: "The page looks empty or out of date.",
        a: "Reload it. If nothing has been created on this network yet, Explore is empty until the first initiative exists.",
      },
    ],
  },
];

const GLOSSARY = [
  ["Milestone", "One part of the work with its own amount, approved on its own."],
  ["Grantee", "The wallet that does the work and receives payments."],
  ["Committee", "The fixed group of reviewer wallets who vote on milestones."],
  ["Approvals needed", "How many committee votes are required to approve a milestone. Always a majority."],
  ["Minimum to proceed", "The share of the goal that must be raised by the deadline for the initiative to go ahead."],
  ["Scaled plan", "When funding ends between the minimum and the goal, every milestone shrinks in proportion."],
  ["Open call", "An initiative with no grantee yet. The committee chooses one after funding."],
  ["Credit", "Money approved for a grantee, waiting to be withdrawn. Nothing is sent until they withdraw."],
  ["Refund pool", "What is left to share back to backers after an initiative fails or is cancelled."],
  ["Gas", "The network fee, paid in ETH, for every transaction."],
  ["Wallet profile", "A public page for any wallet showing what it backed, created, reviewed and received."],
];

const NUMBERS = [
  { value: "1 to 90", label: "days funding stays open" },
  { value: `${MIN_REVIEWERS} to ${MAX_REVIEWERS}`, label: "reviewers on a committee" },
  { value: `${MAX_MILESTONES}`, label: "milestones at most" },
  { value: `${MAX_ROUNDS}`, label: "tries per milestone" },
  { value: `${REVIEW_PERIOD / DAY} days`, label: "for reviewers to vote" },
  { value: `${SUBMISSION_WINDOW / DAY} days`, label: "of silence before it can be cancelled" },
];

const LINKS = [
  { href: "/how-it-works", title: "How it works", text: "The whole journey, step by step." },
  { href: "/terms", title: "Terms & Risks", text: "What you accept by using it." },
  { href: "/stats", title: "Platform stats", text: "Live numbers from the contract." },
];

export const FaqView = () => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(GROUPS[0].id);
  const q = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      GROUPS.map(g => ({
        ...g,
        items: q ? g.items.filter(i => `${i.q} ${i.a}`.toLowerCase().includes(q)) : g.items,
      })).filter(g => g.items.length > 0),
    [q],
  );
  const glossary = useMemo(
    () => (q ? GLOSSARY.filter(([k, v]) => `${k} ${v}`.toLowerCase().includes(q)) : GLOSSARY),
    [q],
  );
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  // Highlight the section that is currently in view in the contents list.
  useEffect(() => {
    const els = GROUPS.map(g => document.getElementById(g.id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    els.forEach(e => obs.observe(e));
    return () => obs.disconnect();
  }, [groups.length]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="relative isolate mb-10 space-y-5">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h1>
          <p className="prose-block opacity-80">
            Short answers to the things people ask first, from how contributions work to what to do when a transaction
            fails.
          </p>
        </div>
        <label className="input input-bordered flex w-full max-w-xl items-center gap-2 bg-base-100">
          <MagnifyingGlassIcon className="h-4 w-4 opacity-60" />
          <input
            className="grow"
            placeholder="Search the answers, for example refund or gas"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search the FAQ"
          />
          {query && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
        </label>
        {q && (
          <p className="text-sm opacity-70" role="status">
            {total === 0 && glossary.length === 0
              ? "No matches."
              : `${total} ${total === 1 ? "answer" : "answers"} and ${glossary.length} glossary ${glossary.length === 1 ? "term" : "terms"} match.`}
          </p>
        )}
      </header>

      {!q && (
        <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Key numbers">
          {NUMBERS.map(n => (
            <div key={n.label} className="surface tile p-4">
              <div className="text-xl font-semibold tabular sm:text-2xl">{n.value}</div>
              <div className="mt-1 text-xs leading-snug opacity-70">{n.label}</div>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="scroll-row -mx-4 flex gap-2 px-4 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {GROUPS.map(g => {
              const count = groups.find(x => x.id === g.id)?.items.length ?? 0;
              const on = active === g.id;
              return (
                <li key={g.id} className="shrink-0">
                  <a
                    href={`#${g.id}`}
                    aria-current={on ? "true" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm whitespace-nowrap lg:whitespace-normal ${
                      on
                        ? "border-primary/50 bg-primary/10 font-medium text-base-content"
                        : "border-base-300 text-base-content/70 hover:bg-base-200/60 hover:text-base-content lg:border-transparent"
                    } ${count === 0 ? "opacity-40" : ""}`}
                  >
                    <g.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{g.title}</span>
                    <span className="text-xs tabular opacity-60">{count}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          {groups.map(g => (
            <section key={g.id} id={g.id} className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <g.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold">{g.title}</h2>
                  <p className="text-sm opacity-60">{g.blurb}</p>
                </div>
              </div>
              <FaqList key={q} defaultOpen={!!q} items={g.items.map(i => ({ q: i.q, a: <p>{i.a}</p> }))} />
            </section>
          ))}

          {glossary.length > 0 && (
            <section id="glossary" className="scroll-mt-24 space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Glossary</h2>
                <p className="text-sm opacity-60">The words used across the site.</p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {glossary.map(([k, v]) => (
                  <div key={k} className="surface p-4">
                    <dt className="font-medium">{k}</dt>
                    <dd className="mt-1 text-sm leading-relaxed opacity-75">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {q && total === 0 && glossary.length === 0 && (
            <div className="surface border-dashed p-10 text-center">
              <p className="font-medium">Nothing matches &ldquo;{query}&rdquo;.</p>
              <p className="mx-auto mt-1 max-w-md text-sm opacity-70">
                Try a shorter or different word, or read the pages below.
              </p>
            </div>
          )}

          <section className="glass tile space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Did not find your answer?</h2>
              <p className="mt-1 max-w-xl text-sm opacity-75">
                These pages go deeper. Everything the contract does is also a public record, so you can always check it
                yourself.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {LINKS.map(l => (
                <Link key={l.href} href={l.href} className="surface card-link block p-4">
                  <span className="block font-medium">{l.title}</span>
                  <span className="mt-0.5 block text-sm opacity-70">{l.text}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
