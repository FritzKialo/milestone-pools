"use client";

import { Address } from "@scaffold-ui/components";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { TOKEN_SYMBOL, fmtAmount } from "~~/lib/pools";
import type { BackerTotal } from "~~/lib/stats";

export const TopBackers = ({ backers, total }: { backers: BackerTotal[]; total: bigint }) => {
  const { targetNetwork } = useTargetNetwork();
  if (backers.length === 0) return <p className="text-sm opacity-70">No backers yet. Be the first.</p>;
  return (
    <ul className="divide-y divide-base-300">
      {backers.map(b => {
        const share = total > 0n ? Number((b.total * 1000n) / total) / 10 : 0;
        return (
          <li key={b.funder} className="flex items-center justify-between gap-3 py-2.5">
            <Address address={b.funder} chain={targetNetwork} />
            <div className="text-right text-sm tabular">
              <div>
                {fmtAmount(b.total)} {TOKEN_SYMBOL}
              </div>
              <div className="text-xs opacity-60">
                {share}% of total, {b.count} {b.count === 1 ? "contribution" : "contributions"}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
