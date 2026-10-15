"use client";

import Link from "next/link";
import { CompareCheck, type CompareProps } from "~~/components/pools/CompareCheck";
import { Cover } from "~~/components/pools/Cover";
import { FundingBar } from "~~/components/pools/FundingBar";
import { SaveButton } from "~~/components/pools/SaveButton";
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

export const InitiativeCard = ({ item, compare }: { item: Listing; compare?: CompareProps }) => {
  const meta = useMetadata(item.metadataURI, item.id);
  const now = useNow(30_000);
  const qualified = isQualified(item);

  return (
    <div className="surface card-link relative flex flex-col overflow-hidden">
      <Link href={`/initiative/${item.id}`} className="flex flex-1 flex-col">
        <Cover image={meta.image} category={item.category} />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm opacity-60">{CATEGORIES[item.category] ?? "Other"}</span>
            <StatusBadge status={item.status} />
          </div>
          <h3 className="text-lg font-semibold leading-snug line-clamp-2">{meta.title}</h3>
          <p className="text-sm opacity-70 line-clamp-3 min-h-[3.75rem]">{meta.summary}</p>
          <div className="mt-auto space-y-3 pt-1">
            <FundingBar
              raised={item.raised}
              goal={item.goal}
              qualifyBps={item.qualifyBps}
              plan={item.plan}
              status={item.status}
              currentMilestone={item.currentMilestone}
              phase={item.phase}
              compact
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm tabular">
              <span>
                <strong>{fmtAmount(item.raised)}</strong> / {fmtAmount(item.goal)} {TOKEN_SYMBOL}
              </span>
              <span className="opacity-70">
                {item.backers} {item.backers === 1 ? "backer" : "backers"}
              </span>
            </div>
            <div className="flex min-h-6 flex-wrap gap-2 text-xs">
              {item.isRfp && <span className="badge badge-outline">Open call</span>}
              {item.status === "Funding" && (
                <>
                  <span className="badge badge-ghost">{timeLeft(item.fundingDeadline, now)}</span>
                  {qualified && <span className="badge badge-success badge-soft">Will proceed</span>}
                </>
              )}
              {item.status === "Active" && (
                <span className="badge badge-ghost">
                  Milestone {Math.min(item.currentMilestone + 1, item.plan.length)} of {item.plan.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      <SaveButton id={item.id} className="absolute right-3 top-3" />
      {compare && <CompareCheck compare={compare} label={meta.title} className="absolute left-3 top-3 z-10" />}
    </div>
  );
};
