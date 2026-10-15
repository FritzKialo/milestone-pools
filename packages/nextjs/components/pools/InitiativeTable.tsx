"use client";

import Link from "next/link";
import { FundingBar } from "~~/components/pools/FundingBar";
import { SaveButton } from "~~/components/pools/SaveButton";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import {
  CATEGORIES,
  type Listing,
  TOKEN_SYMBOL,
  fmtAmount,
  progressPct,
  timeLeft,
  useMetadata,
  useNow,
} from "~~/lib/pools";

const COLUMNS =
  "grid items-center gap-x-4 gap-y-1 px-4 py-3 grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_9rem_minmax(0,2fr)_minmax(0,1.3fr)_4rem_9rem_7rem]";

const Row = ({ item }: { item: Listing }) => {
  const meta = useMetadata(item.metadataURI, item.id);
  const now = useNow(30_000);
  const pct = Math.min(progressPct(item.raised, item.goal), 100);

  const ends =
    item.status === "Funding"
      ? timeLeft(item.fundingDeadline, now)
      : item.status === "Active"
        ? `Milestone ${Math.min(item.currentMilestone + 1, item.plan.length)} of ${item.plan.length}`
        : "-";

  return (
    <li className={`${COLUMNS} relative transition-colors hover:bg-base-200/60`}>
      <SaveButton id={item.id} className="relative z-10" />
      <div className="hidden md:block">
        <StatusBadge status={item.status} />
      </div>
      <div className="min-w-0">
        <Link
          href={`/initiative/${item.id}`}
          className="block truncate font-medium after:absolute after:inset-0 after:content-['']"
        >
          {meta.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 text-xs opacity-60">
          <span>{CATEGORIES[item.category] ?? "Other"}</span>
          {item.isRfp && <span>Open call</span>}
          <span className="md:hidden">
            <StatusBadge status={item.status} />
          </span>
        </div>
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <div className="min-w-0 flex-1">
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
        </div>
        <span className="w-10 text-right text-sm tabular opacity-80">{pct.toFixed(0)}%</span>
      </div>
      <div className="hidden text-right text-sm tabular opacity-80 md:block">{item.backers}</div>
      <div className="text-right text-sm tabular">
        <div>
          <strong>{fmtAmount(item.raised, 0)}</strong>
          <span className="opacity-60"> / {fmtAmount(item.goal, 0)}</span>
        </div>
        <div className="text-xs opacity-60 md:hidden">{pct.toFixed(0)}% funded</div>
        <div className="hidden text-xs opacity-60 md:block">{TOKEN_SYMBOL}</div>
      </div>
      <div className="hidden text-right text-sm opacity-80 md:block">{ends}</div>
    </li>
  );
};

/** A compact list of initiatives. On narrow screens it keeps the title, status and amount. */
export const InitiativeTable = ({ items }: { items: Listing[] }) => (
  <div className="surface overflow-hidden">
    <div
      className={`${COLUMNS} hidden border-b border-base-300 bg-base-200/50 py-2 text-xs font-medium opacity-70 md:grid`}
      aria-hidden="true"
    >
      <span className="w-8" />
      <span>Status</span>
      <span>Initiative</span>
      <span>Funded</span>
      <span className="text-right">Backers</span>
      <span className="text-right">Raised / goal</span>
      <span className="text-right">Next</span>
    </div>
    <ul className="divide-y divide-base-300">
      {items.map(i => (
        <Row key={i.id} item={i} />
      ))}
    </ul>
  </div>
);
