"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import {
  CATEGORIES,
  MAX_MILESTONES,
  MAX_REVIEWERS,
  MIN_REVIEWERS,
  TOKEN_SYMBOL,
  ZERO_ADDRESS,
  encodeMetadata,
  fmtAmount,
  parseAmount,
} from "~~/lib/pools";

type MilestoneRow = { title: string; amount: string };

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="font-medium">{label}</span>
    {hint && <span className="block text-sm opacity-60">{hint}</span>}
    {children}
  </label>
);

const Create: NextPage = () => {
  const router = useRouter();
  const { address } = useAccount();
  const { data: usdc } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "MilestonePools" });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(0);
  const [kind, setKind] = useState<"grant" | "rfp">("grant");
  const [grantee, setGrantee] = useState("");
  const [rows, setRows] = useState<MilestoneRow[]>([{ title: "", amount: "" }]);
  const [qualifyPct, setQualifyPct] = useState(50);
  const [days, setDays] = useState(30);
  const [reviewerText, setReviewerText] = useState("");
  const [threshold, setThreshold] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const reviewers = useMemo(
    () =>
      reviewerText
        .split(/[\s,;]+/)
        .map(s => s.trim())
        .filter(Boolean),
    [reviewerText],
  );
  const minThreshold = Math.floor(reviewers.length / 2) + 1;
  const effectiveThreshold = threshold !== null ? threshold : minThreshold;

  const amounts = rows.map(r => parseAmount(r.amount));
  const goal = amounts.every(a => a !== null && a > 0n) ? (amounts as bigint[]).reduce((a, b) => a + b, 0n) : 0n;

  // Mirror the contract's checks so people see the problem before they pay gas.
  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title.");
  if (!summary.trim()) problems.push("Add a short summary.");
  if (rows.some((_, i) => amounts[i] === null || amounts[i] === 0n))
    problems.push("Every milestone needs an amount above zero.");
  if (kind === "grant") {
    if (!isAddress(grantee)) problems.push("Enter the grantee's wallet address.");
    else if (reviewers.some(r => r.toLowerCase() === grantee.toLowerCase()))
      problems.push("The grantee cannot sit on their own review committee.");
  }
  if (reviewers.length < MIN_REVIEWERS || reviewers.length > MAX_REVIEWERS)
    problems.push(`Choose between ${MIN_REVIEWERS} and ${MAX_REVIEWERS} committee members.`);
  if (reviewers.some(r => !isAddress(r))) problems.push("One of the committee addresses is not valid.");
  if (new Set(reviewers.map(r => r.toLowerCase())).size !== reviewers.length)
    problems.push("Committee members must be different people.");
  if (effectiveThreshold < minThreshold || effectiveThreshold > reviewers.length)
    problems.push("Approvals needed must be a majority of the committee.");

  const setRow = (i: number, patch: Partial<MilestoneRow>) =>
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    if (!usdc || problems.length) return;
    setBusy(true);
    try {
      const metadataURI = encodeMetadata({
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim() || undefined,
        milestones: rows.map(r => r.title.trim()),
      });
      await writeContractAsync({
        functionName: "createInitiative",
        args: [
          {
            token: usdc.address,
            grantee: kind === "rfp" ? ZERO_ADDRESS : (grantee as `0x${string}`),
            milestoneAmounts: amounts as bigint[],
            qualifyBps: Math.round(qualifyPct * 100),
            fundingDuration: BigInt(days * 86_400),
            reviewers: reviewers as `0x${string}`[],
            threshold: effectiveThreshold,
            category,
            metadataURI,
          },
        ],
      });
      router.push("/explore");
    } finally {
      setBusy(false);
    }
  };

  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center space-y-2">
        <h1 className="text-2xl font-bold">Connect a wallet to start an initiative</h1>
        <p className="opacity-70">Use the button at the top right.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Start an initiative</h1>
        <p className="opacity-70 mt-1">
          Once created, the milestones, amounts and review committee are fixed. Nobody, including you, can change them
          later.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">The work</h2>
        <Field label="Title">
          <input
            className="input input-bordered w-full"
            maxLength={120}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Summary" hint="One or two sentences shown on the card.">
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            maxLength={400}
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
        </Field>
        <Field label="Details" hint="Optional. What will be done, why, and how reviewers should judge it.">
          <textarea
            className="textarea textarea-bordered w-full"
            rows={6}
            maxLength={3000}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </Field>
        <Field label="Category">
          <select
            className="select select-bordered w-full"
            value={category}
            onChange={e => setCategory(Number(e.target.value))}
          >
            {CATEGORIES.map((c, i) => (
              <option key={c} value={i}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Who does the work</h2>
        <div className="join">
          <button
            type="button"
            className={`btn join-item ${kind === "grant" ? "btn-neutral" : ""}`}
            onClick={() => setKind("grant")}
          >
            Someone is already chosen
          </button>
          <button
            type="button"
            className={`btn join-item ${kind === "rfp" ? "btn-neutral" : ""}`}
            onClick={() => setKind("rfp")}
          >
            Open call
          </button>
        </div>
        {kind === "grant" ? (
          <Field
            label="Grantee wallet address"
            hint="Payments are credited to this address and only it can withdraw them."
          >
            <input
              className="input input-bordered w-full font-mono"
              placeholder="0x..."
              value={grantee}
              onChange={e => setGrantee(e.target.value.trim())}
            />
          </Field>
        ) : (
          <p className="text-sm opacity-80">
            Funding comes first. When the goal is reached, anyone can offer to do the work and the committee votes on
            who. If they cannot agree within 30 days, everyone is refunded.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Milestones and funding</h2>
        <p className="text-sm opacity-70">
          Money is released one milestone at a time, only after the committee approves. The goal is the sum of the
          amounts, in {TOKEN_SYMBOL}.
        </p>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
              <input
                className="input input-bordered w-full"
                placeholder={`Milestone ${i + 1}: what will be delivered`}
                maxLength={160}
                value={r.title}
                onChange={e => setRow(i, { title: e.target.value })}
                aria-label={`Milestone ${i + 1} description`}
              />
              <input
                className="input input-bordered w-full"
                inputMode="decimal"
                placeholder={`Amount (${TOKEN_SYMBOL})`}
                value={r.amount}
                onChange={e => setRow(i, { amount: e.target.value })}
                aria-label={`Milestone ${i + 1} amount`}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((_, k) => k !== i))}
                aria-label={`Remove milestone ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            disabled={rows.length >= MAX_MILESTONES}
            onClick={() => setRows([...rows, { title: "", amount: "" }])}
          >
            Add milestone
          </button>
        </div>
        <p className="font-medium">Funding goal: {goal > 0n ? `${fmtAmount(goal)} ${TOKEN_SYMBOL}` : "-"}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Funding period: ${days} days`} hint="Between 1 and 90 days.">
            <input
              type="range"
              min={1}
              max={90}
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="range w-full"
            />
          </Field>
          <Field
            label={`Minimum to proceed: ${qualifyPct}% of goal`}
            hint="If the period ends between this and 100%, it goes ahead with smaller milestones. Below it, everyone is refunded."
          >
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={qualifyPct}
              onChange={e => setQualifyPct(Number(e.target.value))}
              className="range w-full"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Review committee</h2>
        <p className="text-sm opacity-70">
          These people decide whether each milestone was delivered. Pick people the backers will trust. If a majority of
          them agree, they can release money for work that was not done, and the contract cannot prevent that.
        </p>
        <Field label={`Wallet addresses (${MIN_REVIEWERS} to ${MAX_REVIEWERS}), one per line`}>
          <textarea
            className="textarea textarea-bordered w-full font-mono text-sm"
            rows={5}
            placeholder={"0x...\n0x...\n0x..."}
            value={reviewerText}
            onChange={e => setReviewerText(e.target.value)}
          />
        </Field>
        <Field
          label={`Approvals needed per milestone: ${reviewers.length ? effectiveThreshold : "-"} of ${reviewers.length}`}
          hint="Must be a majority."
        >
          <input
            type="range"
            className="range w-full"
            min={Math.max(minThreshold, 1)}
            max={Math.max(reviewers.length, minThreshold)}
            value={effectiveThreshold}
            disabled={reviewers.length < MIN_REVIEWERS}
            onChange={e => setThreshold(Number(e.target.value))}
          />
        </Field>
      </section>

      {problems.length > 0 && (
        <ul className="list-disc pl-5 text-sm space-y-1 text-error">
          {problems.map(p => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          className="btn btn-primary btn-lg"
          disabled={busy || problems.length > 0 || !usdc || !pools}
          onClick={submit}
        >
          {busy ? <span className="loading loading-spinner" /> : "Create initiative"}
        </button>
        <p className="text-sm opacity-60 max-w-md">
          This sends one transaction. Nothing is held until people contribute.
        </p>
      </div>
    </div>
  );
};

export default Create;
