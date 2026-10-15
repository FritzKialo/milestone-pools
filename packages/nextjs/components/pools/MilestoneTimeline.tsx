"use client";

import { type Initiative, REVIEW_PERIOD, TOKEN_SYMBOL, fmtAmount, fmtDateTime, safeLink } from "~~/lib/pools";

type Props = {
  item: Initiative;
  plan: bigint[];
  titles?: string[];
  evidenceURI?: string;
};

type State = "paid" | "review" | "waiting" | "upcoming" | "stopped";

export const MilestoneTimeline = ({ item, plan, titles, evidenceURI }: Props) => {
  const stateOf = (m: number): State => {
    if (m < item.currentMilestone) return "paid";
    if (item.status === "Failed" || item.status === "Cancelled") return "stopped";
    if (item.status === "Active" && m === item.currentMilestone) {
      return item.phase === "UnderReview" ? "review" : "waiting";
    }
    return "upcoming";
  };

  const link = evidenceURI ? safeLink(evidenceURI) : null;

  return (
    <ol className="space-y-0">
      {plan.map((amount, m) => {
        const s = stateOf(m);
        return (
          <li key={m} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center border text-sm font-semibold ${
                  s === "paid"
                    ? "bg-success text-success-content border-success"
                    : s === "review" || s === "waiting"
                      ? "border-primary bg-primary text-primary-content"
                      : "border-base-300"
                }`}
              >
                {s === "paid" ? "\u2713" : m + 1}
              </div>
              {m < plan.length - 1 && <div className="w-px grow bg-base-300 min-h-6" />}
            </div>
            <div className="pb-6 grow">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{titles?.[m] || `Milestone ${m + 1}`}</span>
                <span className="text-sm">
                  {fmtAmount(amount)} {TOKEN_SYMBOL}
                </span>
              </div>
              <p className="text-sm opacity-70 mt-0.5">
                {s === "paid" && "Approved and paid out."}
                {s === "upcoming" && item.status === "Funding" && "Starts once funding goes ahead."}
                {s === "upcoming" && item.status !== "Funding" && "Not started."}
                {s === "stopped" && "Not reached."}
                {s === "waiting" &&
                  `Waiting for the grantee to submit evidence. Attempt ${item.submissionsForCurrent + 1} of 3.`}
                {s === "review" &&
                  `Under review: ${item.approvals} of ${item.threshold} approvals needed, ${item.rejections} rejections. Voting closes ${fmtDateTime(
                    item.reviewStartedAt + REVIEW_PERIOD,
                  )}.`}
              </p>
              {s === "review" && evidenceURI && (
                <p className="text-sm mt-1">
                  Evidence:{" "}
                  {link ? (
                    <a className="link break-all" href={link} target="_blank" rel="noreferrer">
                      {evidenceURI}
                    </a>
                  ) : (
                    <span className="break-all">{evidenceURI}</span>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
