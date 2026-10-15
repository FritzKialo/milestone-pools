import { TOKEN_SYMBOL, fmtAmount, progressPct } from "~~/lib/pools";

type Props = { raised: bigint; goal: bigint; qualifyBps: number; compact?: boolean };

/** Funding progress with a marker at the qualification threshold. */
export const FundingBar = ({ raised, goal, qualifyBps, compact }: Props) => {
  const pct = Math.min(progressPct(raised, goal), 100);
  const mark = qualifyBps / 100;
  const qualified = raised * 10_000n >= goal * BigInt(qualifyBps);
  return (
    <div>
      <div className="relative h-2.5 w-full bg-base-300 overflow-visible" role="progressbar" aria-valuenow={pct}>
        <div className={`h-full ${qualified ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        {mark < 100 && (
          <div
            className="absolute -top-1 h-4.5 w-0.5 bg-base-content/60"
            style={{ left: `${mark}%` }}
            title={`Minimum to proceed: ${mark}% of goal`}
          />
        )}
      </div>
      {!compact && (
        <div className="mt-2 flex justify-between text-sm">
          <span>
            <strong>{fmtAmount(raised)}</strong> {TOKEN_SYMBOL} raised of {fmtAmount(goal)}
          </span>
          <span className={qualified ? "text-success font-medium" : "opacity-70"}>
            {qualified ? "Minimum reached" : `Needs ${mark}% to proceed`}
          </span>
        </div>
      )}
    </div>
  );
};
