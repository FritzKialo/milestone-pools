"use client";

import { CheckIcon } from "@heroicons/react/24/solid";
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
    if (m < item.currentMilestone || item.status === "Completed") return "paid";
    if (item.status === "Failed" || item.status === "Cancelled") return "stopped";
    if (item.status === "Active" && m === item.currentMilestone) {
      return item.phase === "UnderReview" ? "review" : "waiting";
    }
    return "upcoming";
  };

  const link = evidenceURI ? safeLink(evidenceURI) : null;

  return (
    <ol>
      {plan.map((amount, m) => {
        const s = stateOf(m);
        return (
          <li key={m} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                  s === "paid"
                    ? "border-success bg-success text-success-content"
                    : s === "review"
                      ? "border-warning bg-warning text-warning-content"
                      : s === "waiting"
                        ? "border-primary bg-primary text-primary-content"
                        : "border-base-300 bg-base-100 opacity-70"
                }`}
              >
                {s === "paid" ? <CheckIcon className="h-4 w-4" /> : m + 1}
              </div>
              {m < plan.length - 1 && (
                <div className={`min-h-6 w-px grow ${s === "paid" ? "bg-success" : "bg-base-300"}`} />
              )}
            </div>
            <div className="grow pb-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{titles?.[m] || `Milestone ${m + 1}`}</span>
                <span className="text-sm tabular">
                  {fmtAmount(amount)} {TOKEN_SYMBOL}
                </span>
              </div>
              <p className="mt-0.5 text-sm opacity-70">
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
                <p className="mt-1 text-sm">
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
