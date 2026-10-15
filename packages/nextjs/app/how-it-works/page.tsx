import Link from "next/link";
import type { NextPage } from "next";

export const metadata = { title: "How it works" };

const ROLES = [
  {
    title: "Backer",
    text: "You contribute to an initiative you believe in. Your money sits in the contract, not with the creator. You can see every vote and payment, and you can claim a refund if the initiative fails or stalls.",
  },
  {
    title: "Creator",
    text: "You propose the work: the milestones and what each one pays, a funding deadline, a minimum to proceed, and the review committee. After you create it, none of that can be changed, including by you.",
  },
  {
    title: "Grantee",
    text: "The person or team doing the work. When a milestone is ready, you submit a link to the evidence. If the committee approves, that milestone's amount is credited to you and you withdraw it.",
  },
  {
    title: "Reviewer",
    text: "One of 3 to 9 wallets named at creation. You look at the evidence for each milestone and vote to approve or reject. A majority must approve before anything is paid.",
  },
];

const STAGES = [
  {
    name: "Funding",
    text: "People contribute for 1 to 90 days. If the goal is reached early, it starts right away.",
  },
  {
    name: "Choosing a grantee",
    text: "Only for open calls. Once funded, anyone can offer to do the work and the committee votes. They have 30 days.",
  },
  {
    name: "In progress",
    text: "The grantee submits one milestone at a time. The committee reviews it for up to 14 days. Approved milestones are paid in order.",
  },
  {
    name: "Finished",
    text: "Completed when every milestone is approved. Failed after three rejections of the same milestone. Cancelled if the grantee is silent for 60 days.",
  },
];

const LIMITS = [
  ["Funding period", "1 to 90 days, chosen by the creator"],
  ["Minimum to proceed", "At least 10% of the goal, chosen by the creator"],
  ["Review committee", "3 to 9 wallets, and the grantee cannot be one of them"],
  ["Approvals needed", "A majority of the committee, chosen by the creator"],
  ["Milestones", "Up to 10"],
  ["Review time", "14 days per submission"],
  ["Attempts per milestone", "3 submissions, then the initiative fails"],
  ["Grantee silence", "60 days without a submission and anyone can cancel"],
  ["Choosing a grantee (open calls)", "30 days, otherwise everyone is refunded"],
];

const SCENARIOS = [
  {
    q: "The goal is reached before the deadline",
    a: "The initiative starts immediately. Contributions stop at the goal.",
  },
  {
    q: "The deadline passes below the goal but above the minimum",
    a: "Anyone can close the funding. The initiative goes ahead and every milestone is scaled down in proportion to what was raised.",
  },
  {
    q: "The deadline passes below the minimum",
    a: "The initiative fails and every backer can claim all of their money back.",
  },
  {
    q: "The committee approves a milestone",
    a: "That milestone's amount is credited to the grantee, who withdraws it when they like. The next milestone opens.",
  },
  {
    q: "The committee rejects a milestone",
    a: "The grantee can submit again, up to three times in total for that milestone. The third rejection fails the initiative.",
  },
  {
    q: "Reviewers do not vote in time",
    a: "After 14 days anyone can close the review. A review with no decision counts as a rejection.",
  },
  {
    q: "The grantee stops responding",
    a: "After 60 days without a submission anyone can cancel the initiative. The money not yet paid out is shared back to backers.",
  },
  {
    q: "The initiative fails or is cancelled",
    a: "Each backer claims their share of what has not been paid out, in proportion to what they contributed. Money already paid for approved milestones stays with the grantee.",
  },
];

const HowItWorks: NextPage = () => (
  <div className="mx-auto w-full max-w-4xl space-y-14 px-4 py-10">
    <header className="space-y-3">
      <h1 className="text-4xl font-bold tracking-tight">How it works</h1>
      <p className="prose-block text-lg opacity-80">
        Milestone Pools lets a group of people fund one piece of work together, and release the money in steps as the
        work is shown. This page walks through who does what, what happens at each stage, and what the limits are.
      </p>
    </header>

    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Who takes part</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map(r => (
          <div key={r.title} className="surface space-y-2 p-5">
            <h3 className="text-lg font-semibold">{r.title}</h3>
            <p className="text-sm leading-relaxed opacity-80">{r.text}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">The stages</h2>
      <ol className="surface divide-y divide-base-300">
        {STAGES.map((s, i) => (
          <li key={s.name} className="flex gap-4 p-5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-content">
              {i + 1}
            </span>
            <div className="space-y-1">
              <h3 className="font-semibold">{s.name}</h3>
              <p className="text-sm leading-relaxed opacity-80">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">What happens if</h2>
      <div className="surface divide-y divide-base-300">
        {SCENARIOS.map(s => (
          <div key={s.q} className="grid gap-1 p-4 sm:grid-cols-[1fr_1.4fr] sm:gap-6">
            <div className="font-medium">{s.q}</div>
            <div className="text-sm leading-relaxed opacity-80">{s.a}</div>
          </div>
        ))}
      </div>
    </section>

    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">The fixed limits</h2>
      <p className="prose-block text-sm opacity-70">
        These are written into the contract. Nobody, including the people who built this site, can change them.
      </p>
      <dl className="surface divide-y divide-base-300">
        {LIMITS.map(([k, v]) => (
          <div key={k} className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_1.4fr] sm:gap-6">
            <dt className="font-medium">{k}</dt>
            <dd className="opacity-80">{v}</dd>
          </div>
        ))}
      </dl>
    </section>

    <section className="surface space-y-3 border-warning/60 p-6">
      <h2 className="text-xl font-semibold">The part that depends on people</h2>
      <p className="prose-block text-sm leading-relaxed opacity-85">
        The contract makes sure a majority of the committee voted before money moves. It cannot check that the work was
        good. If a majority of reviewers agree with each other, for any reason, they can release money for work that was
        not done, or hold it back for work that was. That is why the committee is shown on every page, and why you
        should look at who is on it before you contribute.
      </p>
    </section>

    <div className="flex flex-wrap gap-3">
      <Link href="/explore" className="btn btn-primary">
        Explore initiatives
      </Link>
      <Link href="/faq" className="btn border-base-300 bg-base-100">
        Read the FAQ
      </Link>
      <Link href="/terms" className="btn border-base-300 bg-base-100">
        Terms &amp; Risks
      </Link>
    </div>
  </div>
);

export default HowItWorks;
