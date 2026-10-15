"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TOKEN_DECIMALS, TOKEN_SYMBOL, fmtAmount, fmtDate, fmtDateTime } from "~~/lib/pools";

/* ----------------------------------------------------------------------------
 * A running total that steps up at each contribution.
 * One series, so no legend: the title above the chart says what it shows.
 * ------------------------------------------------------------------------- */

export type SeriesPoint = { time: number; total: bigint; amount: bigint; funder: string };

const toNum = (v: bigint) => Number(v) / 10 ** TOKEN_DECIMALS;

const niceMax = (m: number) => {
  if (m <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const f = m / p;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find(x => f <= x) ?? 10;
  return step * p;
};

const shortFmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`
    : n >= 1_000
      ? `${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`
      : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export const StepChart = ({
  points,
  height = 200,
  label,
}: {
  points: SeriesPoint[];
  height?: number;
  label: string;
}) => {
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const t0 = points[0].time;
    let t1 = points[points.length - 1].time;
    if (t1 <= t0) t1 = t0 + 86_400;
    const maxV = niceMax(Math.max(...points.map(p => toNum(p.total))));
    const x = (t: number) => ((t - t0) / (t1 - t0)) * 1000;
    const y = (v: number) => 100 - (v / maxV) * 100;

    let line = `M ${x(t0)} ${y(0)}`;
    let prev = 0;
    for (const p of points) {
      const v = toNum(p.total);
      line += ` L ${x(p.time)} ${y(prev)} L ${x(p.time)} ${y(v)}`;
      prev = v;
    }
    line += ` L 1000 ${y(prev)}`;
    const area = `${line} L 1000 100 L 0 100 Z`;
    return { t0, t1, maxV, x, y, line, area };
  }, [points]);

  if (!geo) return <p className="text-sm opacity-70">No contributions yet.</p>;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    const t = geo.t0 + ratio * (geo.t1 - geo.t0);
    let idx = 0;
    points.forEach((p, i) => {
      if (p.time <= t) idx = i;
    });
    setHover(idx);
  };

  const hp = hover !== null ? points[hover] : null;
  const hx = hp ? (geo.x(hp.time) / 1000) * 100 : 0;

  return (
    <div>
      <div className="relative pl-12 pr-2 pb-6" style={{ height }}>
        <div className="absolute inset-y-0 left-0 w-10 pb-6">
          <div className="relative h-full text-xs text-right opacity-60 tabular">
            <span className="absolute right-0 top-0 -translate-y-1/2">{shortFmt(geo.maxV)}</span>
            <span className="absolute right-0 top-1/2 -translate-y-1/2">{shortFmt(geo.maxV / 2)}</span>
            <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
          </div>
        </div>
        <div
          className="relative h-full cursor-crosshair border-b border-base-300"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={label}
        >
          {[0, 50, 100].map(g => (
            <div key={g} className="absolute inset-x-0 border-t border-base-300/70" style={{ top: `${g}%` }} />
          ))}
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full text-success"
          >
            <path d={geo.area} fill="currentColor" fillOpacity="0.12" />
            <path
              d={geo.line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
          {points.length <= 40 &&
            points.map((p, i) => (
              <span
                key={i}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success ring-2 ring-base-100"
                style={{ left: `${(geo.x(p.time) / 1000) * 100}%`, top: `${geo.y(toNum(p.total))}%` }}
              />
            ))}
          {hp && (
            <>
              <div className="absolute inset-y-0 w-px bg-base-content/30" style={{ left: `${hx}%` }} />
              <div
                className="pointer-events-none absolute z-10 w-48 -translate-y-full rounded-lg border border-base-300 bg-base-100 p-2 text-xs shadow-md"
                style={{
                  left: `clamp(0px, calc(${hx}% - 6rem), calc(100% - 12rem))`,
                  top: "-4px",
                }}
              >
                <div className="opacity-60">{hp.time ? fmtDateTime(hp.time) : ""}</div>
                <div className="tabular">
                  Total <strong>{fmtAmount(hp.total)}</strong> {TOKEN_SYMBOL}
                </div>
                <div className="tabular opacity-70">
                  +{fmtAmount(hp.amount)} from {hp.funder.slice(0, 6)}&hellip;{hp.funder.slice(-4)}
                </div>
              </div>
            </>
          )}
          <div className="absolute inset-x-0 -bottom-6 flex justify-between text-xs opacity-60">
            <span>{fmtDate(geo.t0)}</span>
            <span>{fmtDate(geo.t1)}</span>
          </div>
        </div>
      </div>
      <details className="mt-2 text-sm">
        <summary className="link cursor-pointer opacity-70">View as table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Contribution</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <td>{p.time ? fmtDateTime(p.time) : ""}</td>
                  <td className="text-right tabular">{fmtAmount(p.amount)}</td>
                  <td className="text-right tabular">{fmtAmount(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * Horizontal bars for comparing a handful of named things
 * ------------------------------------------------------------------------- */

export type BarRow = { label: string; value: number; display: string; href?: string };

export const BarList = ({
  rows,
  tone = "bg-success",
  empty = "Nothing to show yet.",
}: {
  rows: BarRow[];
  tone?: string;
  empty?: string;
}) => {
  const max = Math.max(...rows.map(r => r.value), 0);
  if (rows.length === 0 || max === 0) return <p className="text-sm opacity-70">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map(r => {
        const inner = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular opacity-80">{r.display}</span>
            </div>
            <div className="h-2 rounded-full bg-base-200">
              <div
                className={`h-full rounded-full ${tone}`}
                style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? (
              <Link href={r.href} className="block hover:opacity-80">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
};

/* ----------------------------------------------------------------------------
 * Columns for a short run of equal periods (days). Each column explains itself on hover or focus.
 * ------------------------------------------------------------------------- */

export type Column = { label: string; value: number; note: string };

export const ColumnChart = ({ columns, label, empty }: { columns: Column[]; label: string; empty: string }) => {
  const max = Math.max(...columns.map(c => c.value), 0);
  if (columns.length === 0 || max === 0) return <p className="text-sm opacity-70">{empty}</p>;
  return (
    <div role="group" aria-label={label}>
      <div className="flex h-44 items-end gap-1 sm:gap-1.5">
        {columns.map((c, i) => (
          <div
            key={`${c.label}-${i}`}
            tabIndex={0}
            role="img"
            aria-label={`${c.label}: ${c.note}`}
            className="group relative flex h-full flex-1 items-end rounded-t-md outline-offset-2"
          >
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-primary/35 to-primary transition-[filter] group-hover:brightness-125 group-focus:brightness-125"
              style={{
                height: `${c.value > 0 ? Math.max((c.value / max) * 100, 4) : 1}%`,
                opacity: c.value > 0 ? 1 : 0.25,
              }}
            />
            <span
              className={`pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-md border border-base-300 bg-base-100 px-2 py-1 text-xs shadow-lg group-hover:block group-focus:block ${
                i < 2 ? "left-0" : i > columns.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
              }`}
            >
              <strong>{c.label}</strong>, {c.note}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs opacity-60">
        <span>{columns[0].label}</span>
        <span>{columns[columns.length - 1].label}</span>
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------------------
 * A ring split into two or three named parts, with the main figure in the middle.
 * ------------------------------------------------------------------------- */

export type DonutPart = { label: string; value: number; stroke: string; dot: string };

export const Donut = ({
  parts,
  center,
  sub,
  label,
  empty,
}: {
  parts: DonutPart[];
  center: string;
  sub: string;
  label: string;
  empty: string;
}) => {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return <p className="text-sm opacity-70">{empty}</p>;
  const C = 2 * Math.PI * 40;
  const segments = parts
    .filter(p => p.value > 0)
    .reduce<{ part: DonutPart; start: number; len: number }[]>((acc, p) => {
      const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0;
      return [...acc, { part: p, start, len: (p.value / total) * C }];
    }, []);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-36 w-36 shrink-0" role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="11" className="stroke-base-300" />
          {segments.map(({ part, start, len }) => (
            <circle
              key={part.label}
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="11"
              className={part.stroke}
              strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C}`}
              strokeDashoffset={-start}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular">{center}</span>
          <span className="text-xs opacity-60">{sub}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {parts.map(p => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />
            <span className="tabular">
              <strong>{p.value}</strong> <span className="opacity-70">{p.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
