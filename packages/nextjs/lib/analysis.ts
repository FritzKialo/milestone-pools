import { DAY, type Initiative, type PoolEvent, SUBMISSION_WINDOW, TOKEN_SYMBOL, fmtAmount } from "~~/lib/pools";

/* ----------------------------------------------------------------------------
 * Plain facts about an initiative, read from the contract's own data.
 * These are not scores and not advice: each line says what is true and why it matters.
 * ------------------------------------------------------------------------- */

export type Check = { key: string; tone: "ok" | "note" | "warn"; title: string; detail: string };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function buildChecks(args: {
  item: Initiative;
  plan: bigint[];
  reviewers: string[];
  /** Share of the pool held by the largest backer, in percent, or null when nothing is pooled yet. */
  topSharePct: number | null;
  now: number;
}): Check[] {
  const { item, plan, reviewers, topSharePct, now } = args;
  const out: Check[] = [];

  if (reviewers.some(r => same(r, item.proposer))) {
    out.push({
      key: "creator-reviews",
      tone: "note",
      title: "The creator sits on the review committee",
      detail:
        "The person who set up the initiative also votes on whether its milestones were delivered. Look at the other reviewers to judge how independent the committee is.",
    });
  } else {
    out.push({
      key: "creator-reviews",
      tone: "ok",
      title: "The creator is not on the review committee",
      detail: "The people who vote on the milestones are different from the person who set up the initiative.",
    });
  }

  const n = item.reviewerCount;
  out.push({
    key: "committee",
    tone: n <= 3 ? "note" : "ok",
    title: `${item.threshold} of ${n} reviewers must approve each milestone`,
    detail:
      n <= 3
        ? `With a committee this small, ${item.threshold} wallets acting together can release money. Check that you trust them.`
        : `Fewer than ${item.threshold} wallets cannot release money, and ${item.threshold} acting together can. A larger committee makes that harder.`,
  });

  if (plan.length === 1) {
    out.push({
      key: "single-milestone",
      tone: "warn",
      title: "Everything is paid after a single approval",
      detail: "There is only one milestone, so the whole amount is released at once when the committee approves it.",
    });
  } else if (plan.length > 1 && item.goal > 0n) {
    const first = Number((plan[0] * 1000n) / item.goal) / 10;
    out.push({
      key: "first-milestone",
      tone: first >= 50 ? "note" : "ok",
      title: `The first milestone pays ${first}% of the plan`,
      detail:
        first >= 50
          ? "A large first payment means more of the money leaves the pool early, before later milestones can protect it."
          : `The rest is held back until later milestones are approved, so most of the money stays refundable early on.`,
    });
  }

  if (item.qualifyBps < 5000) {
    out.push({
      key: "minimum",
      tone: "note",
      title: `It can go ahead with as little as ${item.qualifyBps / 100}% of the goal`,
      detail:
        "If funding ends below the goal, every milestone shrinks in proportion, so the work delivered may be smaller than described.",
    });
  } else {
    out.push({
      key: "minimum",
      tone: "ok",
      title: `It needs at least ${item.qualifyBps / 100}% of the goal to go ahead`,
      detail: "Below that, everyone is refunded in full.",
    });
  }

  if (topSharePct !== null && item.backers > 1 && topSharePct >= 50) {
    out.push({
      key: "concentration",
      tone: "note",
      title: `One wallet provided ${topSharePct}% of the pool`,
      detail: "A single large backer is carrying most of the funding. That says little about the project either way.",
    });
  }

  if (item.status === "Active" && item.phase === "AwaitingSubmission") {
    const left = Math.ceil((item.lastActivity + SUBMISSION_WINDOW - now) / DAY);
    out.push({
      key: "silence",
      tone: left <= 14 ? "warn" : "note",
      title:
        left > 0
          ? `${left} ${left === 1 ? "day" : "days"} until it can be cancelled for silence`
          : "It can be cancelled now",
      detail:
        left > 0
          ? "If the grantee submits nothing for 60 days, anyone can cancel it and the unpaid part goes back to backers."
          : "The grantee has not submitted for 60 days. Anyone can cancel it, and the unpaid part goes back to backers.",
    });
  }

  return out;
}

/* ----------------------------------------------------------------------------
 * Reviewer track record, from the vote events
 * ------------------------------------------------------------------------- */

export type ReviewerRecord = { votes: number; approvals: number; committees: number };

export function reviewerRecords(events: PoolEvent[] | undefined): Map<string, ReviewerRecord> {
  const map = new Map<string, ReviewerRecord>();
  const get = (a: string) => {
    const k = a.toLowerCase();
    const cur = map.get(k) ?? { votes: 0, approvals: 0, committees: 0 };
    map.set(k, cur);
    return cur;
  };
  (events ?? []).forEach(e => {
    if (e.eventName === "InitiativeDetails") {
      ((e.args.reviewers as string[] | undefined) ?? []).forEach(r => (get(r).committees += 1));
    } else if (e.eventName === "ReviewVote") {
      const r = get(e.args.reviewer);
      r.votes += 1;
      if (e.args.approve) r.approvals += 1;
    }
  });
  return map;
}

export function describeRecord(r: ReviewerRecord | undefined): string {
  if (!r) return "No history yet";
  const committees = `on ${r.committees} ${r.committees === 1 ? "committee" : "committees"}`;
  if (r.votes === 0) return `No votes cast yet, ${committees}`;
  return `${r.votes} ${r.votes === 1 ? "vote" : "votes"} cast, ${Math.round((r.approvals / r.votes) * 100)}% approve, ${committees}`;
}

/* ----------------------------------------------------------------------------
 * Payout maths, the same arithmetic the contract uses
 * ------------------------------------------------------------------------- */

/** Milestone amounts after scaling to what was raised. The last one absorbs rounding, as in the contract. */
export function scaledPlan(plan: bigint[], raised: bigint, goal: bigint): bigint[] {
  if (plan.length === 0 || goal === 0n) return [];
  if (raised >= goal) return [...plan];
  const out: bigint[] = [];
  let assigned = 0n;
  for (let i = 0; i < plan.length - 1; i++) {
    const s = (plan[i] * raised) / goal;
    out.push(s);
    assigned += s;
  }
  out.push(raised - assigned);
  return out;
}

export type PayoutRow = {
  milestone: number;
  pays: bigint;
  yourShareOfIt: bigint;
  refundIfFailsHere: bigint;
};

/** For a contribution `mine` and a final pool `finalRaised`: what each milestone pays, and what comes back if it fails there. */
export function payoutRows(plan: bigint[], finalRaised: bigint, goal: bigint, mine: bigint): PayoutRow[] {
  const scaled = scaledPlan(plan, finalRaised, goal);
  if (finalRaised === 0n) return [];
  let paidBefore = 0n;
  return scaled.map((pays, i) => {
    const row = {
      milestone: i + 1,
      pays,
      yourShareOfIt: (mine * pays) / finalRaised,
      refundIfFailsHere: (mine * (finalRaised - paidBefore)) / finalRaised,
    };
    paidBefore += pays;
    return row;
  });
}

export const fmtUsdc = (v: bigint) => `${fmtAmount(v)} ${TOKEN_SYMBOL}`;
