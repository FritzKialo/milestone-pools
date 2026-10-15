"use client";

import { WalletChip } from "~~/components/pools/WalletChip";
import { TOKEN_SYMBOL, fmtAmount } from "~~/lib/pools";
import type { BackerTotal, ReviewerStat } from "~~/lib/stats";

const Group = ({ title, note, children }: { title: string; note: string; children: React.ReactNode }) => (
  <div className="min-w-0 space-y-3 p-5">
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs opacity-60">{note}</p>
    </div>
    {children}
  </div>
);

/** The wallets that carry the platform: who has put in the most, and who reviews the most. */
export const PeopleStrip = ({ backers, reviewers }: { backers: BackerTotal[]; reviewers: ReviewerStat[] }) => (
  <div className="surface grid divide-y divide-base-300 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
    <Group title="Top backers" note="Ranked by total contributed. Select one to see everything it has backed.">
      {backers.length === 0 ? (
        <p className="text-sm opacity-70">Nobody has contributed yet.</p>
      ) : (
        <div className="scroll-row -mx-1 flex gap-2 px-1 pb-1">
          {backers.map(b => (
            <div key={b.funder} className="w-52 shrink-0 rounded-lg bg-base-200/70 p-3">
              <WalletChip address={b.funder} sub={`${fmtAmount(b.total)} ${TOKEN_SYMBOL}`} />
            </div>
          ))}
        </div>
      )}
    </Group>
    <Group title="Most active reviewers" note="Ranked by votes cast on milestones.">
      {reviewers.length === 0 ? (
        <p className="text-sm opacity-70">No committees yet.</p>
      ) : (
        <div className="scroll-row -mx-1 flex gap-2 px-1 pb-1">
          {reviewers.map(r => (
            <div key={r.reviewer} className="w-52 shrink-0 rounded-lg bg-base-200/70 p-3">
              <WalletChip
                address={r.reviewer}
                sub={`${r.votes} ${r.votes === 1 ? "vote" : "votes"}, ${r.committees} ${r.committees === 1 ? "committee" : "committees"}`}
              />
            </div>
          ))}
        </div>
      )}
    </Group>
  </div>
);
