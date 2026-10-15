import { type StatusName, TOKEN_SYMBOL, fmtAmount, progressPct } from "~~/lib/pools";

type Props = {
  raised: bigint;
  goal: bigint;
  qualifyBps: number;
  compact?: boolean;
  /** Milestone amounts. When given, the bar is split into one segment per milestone. */
  plan?: bigint[];
  status?: StatusName;
  currentMilestone?: number;
  phase?: "AwaitingSubmission" | "UnderReview";
};

type Seg = { weight: number; fill: number; tone: string };

/**
 * Funding progress drawn as one segment per milestone.
 * While funding, the pool fills the segments from the left. Afterwards each
 * segment shows whether that milestone was paid, is under review, or is still ahead.
 */
export const FundingBar = ({
  raised,
  goal,
  qualifyBps,
  compact,
  plan,
  status = "Funding",
  currentMilestone = 0,
  phase,
}: Props) => {
  const pct = Math.min(progressPct(raised, goal), 100);
  const mark = qualifyBps / 100;
  const qualified = raised * 10_000n >= goal * BigInt(qualifyBps);
  const amounts = plan && plan.length > 0 ? plan : [goal];
  const total = amounts.reduce((a, b) => a + b, 0n) || 1n;

  const segs: Seg[] = [];
  let start = 0n;
  amounts.forEach((a, i) => {
    const end = start + a;
    const weight = Math.max(Number((a * 10_000n) / total), 1);
    let fill = 0;
    let tone = "bg-base-300";
    if (status === "Funding") {
      const covered = raised > start ? (raised >= end ? 1 : Number(((raised - start) * 10_000n) / a) / 10_000) : 0;
      fill = covered;
      tone = qualified ? "bg-success" : "bg-primary";
    } else if (i < currentMilestone || status === "Completed") {
      fill = 1;
      tone = "bg-success";
    } else if (status === "Failed" || status === "Cancelled") {
      fill = 0;
    } else if (status === "Active" && i === currentMilestone) {
      fill = 1;
      tone = phase === "UnderReview" ? "bg-warning" : "bg-success/45";
    } else if (status === "Active" || status === "Selecting") {
      fill = 1;
      tone = "bg-success/20";
    }
    segs.push({ weight, fill, tone });
    start = end;
  });

  return (
    <div>
      <div className="relative">
        <div
          className="flex h-2.5 w-full gap-0.5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Funding progress"
        >
          {segs.map((s, i) => (
            <div
              key={i}
              className="relative h-full overflow-hidden rounded-full bg-base-300"
              style={{ flexGrow: s.weight, flexBasis: 0 }}
            >
              <div className={`h-full ${s.tone}`} style={{ width: `${s.fill * 100}%` }} />
            </div>
          ))}
        </div>
        {status === "Funding" && mark < 100 && (
          <div
            className="absolute -top-1 h-[18px] w-0.5 bg-base-content/70"
            style={{ left: `${mark}%` }}
            title={`Minimum to proceed: ${mark}% of goal`}
          />
        )}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm">
          <span className="tabular">
            <strong>{fmtAmount(raised)}</strong> {TOKEN_SYMBOL} raised of {fmtAmount(goal)}
          </span>
          {status === "Funding" && (
            <span className={qualified ? "text-success font-medium" : "opacity-70"}>
              {qualified ? "Minimum reached" : `Needs ${mark}% to proceed`}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
