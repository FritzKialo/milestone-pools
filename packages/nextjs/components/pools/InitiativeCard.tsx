"use client";

import Link from "next/link";
import { FundingBar } from "~~/components/pools/FundingBar";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import {
  CATEGORIES,
  type Listing,
  TOKEN_SYMBOL,
  fmtAmount,
  isQualified,
  timeLeft,
  useMetadata,
  useNow,
} from "~~/lib/pools";

export const InitiativeCard = ({ item }: { item: Listing }) => {
  const meta = useMetadata(item.metadataURI, item.id);
  const now = useNow(30_000);
  const qualified = isQualified(item);

  return (
    <Link
      href={`/initiative/${item.id}`}
      className="card bg-base-100 border border-base-300 hover:border-base-content/40 transition-colors"
    >
      <div className="card-body gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide opacity-60">{CATEGORIES[item.category] ?? "Other"}</span>
          <StatusBadge status={item.status} />
        </div>
        <h3 className="text-lg font-semibold leading-snug line-clamp-2">{meta.title}</h3>
        <p className="text-sm opacity-70 line-clamp-3 min-h-[3.75rem]">{meta.summary}</p>
        <FundingBar raised={item.raised} goal={item.goal} qualifyBps={item.qualifyBps} compact />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span>
            <strong>{fmtAmount(item.raised)}</strong> / {fmtAmount(item.goal)} {TOKEN_SYMBOL}
          </span>
          <span className="opacity-70">
            {item.backers} {item.backers === 1 ? "backer" : "backers"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {item.isRfp && <span className="badge badge-outline">Open call</span>}
          {item.status === "Funding" && (
            <>
              <span className="badge badge-ghost">{timeLeft(item.fundingDeadline, now)}</span>
              {qualified && <span className="badge badge-success badge-outline">Will proceed</span>}
            </>
          )}
          {item.status === "Active" && (
            <span className="badge badge-ghost">
              Milestone {Math.min(item.currentMilestone + 1, item.plan.length)} of {item.plan.length}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
