"use client";

import { useState } from "react";
import { WalletChip } from "~~/components/pools/WalletChip";
import { TOKEN_SYMBOL, fmtAmount } from "~~/lib/pools";
import type { BackerTotal, CreatorStat, GranteeStat, ReviewerStat } from "~~/lib/stats";

type Tab = "backers" | "reviewers" | "creators" | "grantees";

const TABS: { key: Tab; label: string; note: string }[] = [
  { key: "backers", label: "Backers", note: "Ranked by total contributed" },
  { key: "reviewers", label: "Reviewers", note: "Ranked by votes cast" },
  { key: "creators", label: "Creators", note: "Ranked by initiatives proposed" },
  { key: "grantees", label: "Grantees", note: "Ranked by amount paid for approved work" },
];

type Row = { address: `0x${string}`; sub: string; figure: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const Leaderboards = ({
  backers,
  reviewers,
  creators,
  grantees,
}: {
  backers: BackerTotal[];
  reviewers: ReviewerStat[];
  creators: CreatorStat[];
  grantees: GranteeStat[];
}) => {
  const [tab, setTab] = useState<Tab>("backers");

  const rows: Record<Tab, Row[]> = {
    backers: backers.map(b => ({
      address: b.funder,
      sub: plural(b.count, "contribution", "contributions"),
      figure: `${fmtAmount(b.total)} ${TOKEN_SYMBOL}`,
    })),
    reviewers: reviewers
      .filter(r => r.votes > 0)
      .map(r => ({
        address: r.reviewer,
        sub: `on ${plural(r.committees, "committee", "committees")}`,
        figure: plural(r.votes, "vote", "votes"),
      })),
    creators: creators.map(c => ({
      address: c.proposer,
      sub: `${fmtAmount(c.raised, 0)} ${TOKEN_SYMBOL} raised in total`,
      figure: plural(c.initiatives, "initiative", "initiatives"),
    })),
    grantees: grantees.map(g => ({
      address: g.grantee,
      sub: plural(g.milestones, "milestone approved", "milestones approved"),
      figure: `${fmtAmount(g.paid)} ${TOKEN_SYMBOL}`,
    })),
  };

  const current = TABS.find(t => t.key === tab)!;
  const list = rows[tab];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "border-base-300 bg-base-100 hover:bg-base-200"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs opacity-60">{current.note}</p>
      {list.length === 0 ? (
        <p className="text-sm opacity-70">Nobody here yet.</p>
      ) : (
        <ol className="divide-y divide-base-300" key={tab}>
          {list.map((r, i) => (
            <li key={r.address} className="flex items-center gap-3 py-2.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular ${
                  i === 0 ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"
                }`}
              >
                {i + 1}
              </span>
              <WalletChip address={r.address} sub={r.sub} className="flex-1" />
              <span className="shrink-0 text-sm font-medium tabular">{r.figure}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
