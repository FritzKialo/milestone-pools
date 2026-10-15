"use client";

import { useState } from "react";
import { fmtUsdc, payoutRows } from "~~/lib/analysis";
import { type Initiative, TOKEN_SYMBOL, fmtAmount, parseAmount } from "~~/lib/pools";

/** "What if" tool for a backer: how a contribution is spread across milestones and what comes back if it fails. */
export const PayoutSimulator = ({ item, plan }: { item: Initiative; plan: bigint[] }) => {
  const minPct = Math.max(
    Math.ceil(item.qualifyBps / 100),
    Math.min(100, Math.ceil(Number((item.raised * 100n) / (item.goal || 1n)))),
  );
  const [text, setText] = useState("100");
  const [pct, setPct] = useState(100);

  const effectivePct = Math.min(100, Math.max(pct, minPct));
  const mine = parseAmount(text);
  const finalRaised = (item.goal * BigInt(effectivePct)) / 100n;
  const rows = mine && mine > 0n && mine <= finalRaised ? payoutRows(plan, finalRaised, item.goal, mine) : [];
  const share = mine && finalRaised > 0n ? Math.min(100, Number((mine * 10_000n) / finalRaised) / 100) : 0;

  return (
    <details className="group rounded-xl border border-base-300 bg-base-200/40">
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm font-medium">
        See where your money would go
        <span className="text-xs opacity-60 group-open:hidden">Open</span>
      </summary>
      <div className="space-y-4 border-t border-base-300 p-3 text-sm">
        <div className="grid gap-3">
          <label className="space-y-1">
            <span className="opacity-70">If you contribute</span>
            <span className="flex items-center gap-2">
              <input
                className="input input-bordered input-sm w-full bg-base-100"
                inputMode="decimal"
                value={text}
                onChange={e => setText(e.target.value)}
                aria-label="Amount to try"
              />
              <span className="shrink-0 opacity-70">{TOKEN_SYMBOL}</span>
            </span>
          </label>
          <label className="space-y-1">
            <span className="flex justify-between opacity-70">
              <span>And the pool ends at</span>
              <span className="tabular">
                {effectivePct}% of goal ({fmtAmount(finalRaised, 0)} {TOKEN_SYMBOL})
              </span>
            </span>
            <input
              type="range"
              className="range range-primary range-xs w-full"
              min={minPct}
              max={100}
              step={1}
              value={effectivePct}
              onChange={e => setPct(Number(e.target.value))}
              aria-label="Where the pool ends, as a percentage of the goal"
            />
          </label>
        </div>

        {!mine || mine === 0n ? (
          <p className="opacity-70">Enter an amount to try.</p>
        ) : mine > finalRaised ? (
          <p className="text-error">That is more than the pool would hold at this size.</p>
        ) : (
          <>
            <p className="opacity-80">
              You would own <strong className="tabular">{share}%</strong> of the pool. Milestones are paid from the
              whole pool, so your share of each one is in proportion.
              {effectivePct < 100 && " Because the goal is not reached, every milestone is scaled down."}
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm tabular">
                <thead>
                  <tr>
                    <th>Milestone</th>
                    <th className="text-right">Pays out</th>
                    <th className="text-right">Your part</th>
                    <th className="text-right">You get back if it fails here</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.milestone}>
                      <td>{r.milestone}</td>
                      <td className="text-right">{fmtUsdc(r.pays)}</td>
                      <td className="text-right">{fmtUsdc(r.yourShareOfIt)}</td>
                      <td className="text-right">{fmtUsdc(r.refundIfFailsHere)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs opacity-60">
              &ldquo;Fails here&rdquo; means that milestone is rejected three times (or the grantee goes silent) after
              the earlier ones were paid. Amounts are estimates; the contract rounds down by a tiny amount. Money
              already paid for approved milestones is not refunded.
            </p>
          </>
        )}
      </div>
    </details>
  );
};
