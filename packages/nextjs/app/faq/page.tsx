import Link from "next/link";
import type { NextPage } from "next";
import { FaqList } from "~~/components/pools/FaqList";

export const metadata = { title: "FAQ" };

const GROUPS = [
  {
    title: "The basics",
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
    ],
  },
  {
    title: "Contributing",
    items: [
      {
        q: "How do I contribute?",
        a: "Connect a wallet, open an initiative that is still funding, enter an amount and confirm two transactions: first you allow the exact amount, then you contribute it.",
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
        a: "The star keeps an initiative in your Saved filter on Explore. It is stored in this browser only. Nobody else sees it, and it does not move to another device.",
      },
    ],
  },
  {
    title: "Creating an initiative",
    items: [
      {
        q: "What do I decide when I create one?",
        a: "The milestones and amounts, how long funding is open, the minimum share of the goal needed to go ahead, who the grantee is (or an open call), the review committee, and how many approvals are needed per milestone.",
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
    title: "Reviewing and delivering",
    items: [
      {
        q: "How does a milestone get paid?",
        a: "The grantee submits a link to evidence. Reviewers vote for up to 14 days. When enough approve, that milestone's amount is credited to the grantee, who withdraws it when they like.",
      },
      {
        q: "What counts as enough approvals?",
        a: "The number set at creation, which is always a majority of the committee. Once approval is no longer possible, the attempt is rejected straight away without waiting for the deadline.",
      },
      {
        q: "What if reviewers do not vote?",
        a: "After 14 days anyone can close the review. A review with no decision counts as a rejection, so reviewers who stay silent work against the grantee.",
      },
      {
        q: "How many tries does the grantee get?",
        a: "Three submissions for each milestone. Each approved milestone starts with three fresh tries. A third rejection fails the initiative.",
      },
      {
        q: "What if the grantee disappears?",
        a: "After 60 days without a submission, anyone can cancel it. The unpaid part is shared back to backers.",
      },
    ],
  },
  {
    title: "Safety",
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
        q: "Does anything here count as advice?",
        a: "No. Nothing on this site is legal, financial or tax advice. Rules about pooling money and digital tokens differ between countries, so check what applies to you.",
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
];

const Faq: NextPage = () => (
  <div className="mx-auto w-full max-w-3xl space-y-12 px-4 py-10">
    <header className="space-y-3">
      <h1 className="text-4xl font-bold tracking-tight">Frequently asked questions</h1>
      <p className="prose-block opacity-80">
        Short answers to the things people ask first. For the full picture, read{" "}
        <Link href="/how-it-works" className="link">
          how it works
        </Link>{" "}
        and the{" "}
        <Link href="/terms" className="link">
          Terms &amp; Risks
        </Link>
        .
      </p>
    </header>

    {GROUPS.map(g => (
      <section key={g.title} className="space-y-3">
        <h2 className="text-xl font-semibold">{g.title}</h2>
        <FaqList items={g.items.map(i => ({ q: i.q, a: <p>{i.a}</p> }))} />
      </section>
    ))}

    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Glossary</h2>
      <dl className="surface divide-y divide-base-300">
        {GLOSSARY.map(([k, v]) => (
          <div key={k} className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_2fr] sm:gap-6">
            <dt className="font-medium">{k}</dt>
            <dd className="opacity-80">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  </div>
);

export default Faq;
