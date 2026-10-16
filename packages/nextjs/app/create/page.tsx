"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ChainBadge } from "~~/components/pools/ChainBadge";
import { Cover } from "~~/components/pools/Cover";
import { FundingBar } from "~~/components/pools/FundingBar";
import { Hint } from "~~/components/pools/Hint";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { DEFAULT_POOL_CHAIN, MULTI_CHAIN, POOL_CHAINS, poolChain } from "~~/lib/chains";
import {
  CATEGORIES,
  MAX_FAQ,
  MAX_LINKS,
  MAX_MILESTONES,
  MAX_REVIEWERS,
  MIN_REVIEWERS,
  type MetaFaq,
  type MetaLink,
  TOKEN_SYMBOL,
  ZERO_ADDRESS,
  encodeMetadata,
  fmtAmount,
  parseAmount,
} from "~~/lib/pools";

type MilestoneRow = { title: string; amount: string };

const Field = ({
  label,
  hint,
  tip,
  children,
}: {
  label: string;
  hint?: string;
  tip?: string;
  children: React.ReactNode;
}) => (
  <label className="block space-y-1.5">
    <span className="flex items-center gap-1.5 font-medium">
      {label}
      {tip && <Hint text={tip} />}
    </span>
    {hint && <span className="block text-sm opacity-60">{hint}</span>}
    {children}
  </label>
);

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="surface space-y-5 p-6">
    <h2 className="flex items-center gap-3 text-xl font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-content">
        {n}
      </span>
      {title}
    </h2>
    {children}
  </section>
);

const CHECKLIST = [
  "Your reviewers know they have been named and are willing to vote on time.",
  "The grantee address is correct and belongs to the person doing the work.",
  "Each milestone says what will be shown, so reviewers can judge it.",
  "You are comfortable that nothing here can be changed afterwards.",
];

const Create: NextPage = () => {
  const router = useRouter();
  const { address, chain: walletChain } = useAccount();
  const [chainChoice, setChainChoice] = useState<number | null>(null);
  // Start on the network the wallet is already on, when the site supports it.
  const chainId = chainChoice ?? poolChain(walletChain?.id)?.id ?? DEFAULT_POOL_CHAIN?.id ?? 0;
  const net = poolChain(chainId);
  const usdc = net?.usdc;
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "MilestonePools", chainId });

  // The beta limit for one initiative on this network. Older deployments have no limit, so a failed read is ignored.
  const { data: goalLimit } = useReadContract({
    chainId,
    address: net?.pools.address,
    abi: net?.pools.abi,
    functionName: "maxGoal",
    args: usdc ? [usdc] : undefined,
    query: { enabled: !!net && !!usdc },
  });
  const limit = typeof goalLimit === "bigint" ? goalLimit : undefined;

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(0);
  const [image, setImage] = useState("");
  const [links, setLinks] = useState<MetaLink[]>([]);
  const [faq, setFaq] = useState<MetaFaq[]>([]);
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
  const allValid = amounts.every(a => a !== null && a > 0n);
  const goal = allValid ? (amounts as bigint[]).reduce((a, b) => a + b, 0n) : 0n;

  const cleanLinks = links.filter(l => l.label.trim() || l.url.trim());
  const cleanFaq = faq.filter(f => f.q.trim() || f.a.trim());

  const metadataURI = useMemo(
    () =>
      encodeMetadata({
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim() || undefined,
        milestones: rows.map(r => r.title.trim()),
        image: image.trim() || undefined,
        links: cleanLinks.length ? cleanLinks.map(l => ({ label: l.label.trim(), url: l.url.trim() })) : undefined,
        faq: cleanFaq.length ? cleanFaq.map(f => ({ q: f.q.trim(), a: f.a.trim() })) : undefined,
      }),
    [title, summary, body, rows, image, cleanLinks, cleanFaq],
  );
  const sizeKb = metadataURI.length / 1024;

  // Mirror the contract's checks so people see the problem before they pay gas.
  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title.");
  if (!summary.trim()) problems.push("Add a short summary.");
  if (rows.some((_, i) => amounts[i] === null || amounts[i] === 0n))
    problems.push("Every milestone needs an amount above zero.");
  else if (amounts.some(x => x !== null && x * BigInt(Math.round(qualifyPct * 100)) < 10_000n))
    problems.push("A milestone is too small for the chosen minimum to proceed. Raise its amount or the percentage.");
  if (limit !== undefined && goal > limit)
    problems.push(
      `This network is in beta and limits each initiative to ${fmtAmount(limit)} ${TOKEN_SYMBOL}. Lower the total to continue.`,
    );
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
  if (image.trim() && !image.trim().startsWith("https://"))
    problems.push("The cover image link must start with https://");
  if (cleanLinks.some(l => !l.label.trim() || !l.url.trim().startsWith("https://")))
    problems.push("Each link needs a name and an address starting with https://");
  if (cleanFaq.some(f => !f.q.trim() || !f.a.trim()))
    problems.push("Each question needs both a question and an answer.");

  const setRow = (i: number, patch: Partial<MilestoneRow>) =>
    setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    if (!usdc || problems.length) return;
    setBusy(true);
    try {
      await writeContractAsync({
        functionName: "createInitiative",
        args: [
          {
            token: usdc,
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
      <div className="mx-auto max-w-xl space-y-2 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Connect a wallet to start an initiative</h1>
        <p className="opacity-70">Use the button at the top right.</p>
      </div>
    );
  }

  const previewPlan = allValid ? (amounts as bigint[]) : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold">Start an initiative</h1>
        <p className="max-w-2xl opacity-70">
          Once created, the milestones, amounts and review committee are fixed. Nobody, including you, can change them
          later.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Step n={1} title="The work">
            {MULTI_CHAIN && (
              <Field
                label="Network"
                hint="Where the funds are held. Backers need USDC on this network, and each network has its own fees and its own pool of funds."
              >
                <div className="flex flex-wrap gap-2" role="group" aria-label="Network">
                  {POOL_CHAINS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`btn btn-sm ${chainId === c.id ? "btn-primary" : "border-base-300 bg-base-100"}`}
                      aria-pressed={chainId === c.id}
                      onClick={() => setChainChoice(c.id)}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
                      {c.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
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
          </Step>

          <Step n={2} title="Who does the work">
            <div className="join">
              <button
                type="button"
                className={`btn join-item ${kind === "grant" ? "btn-primary" : "border-base-300 bg-base-100"}`}
                onClick={() => setKind("grant")}
              >
                Someone is already chosen
              </button>
              <button
                type="button"
                className={`btn join-item ${kind === "rfp" ? "btn-primary" : "border-base-300 bg-base-100"}`}
                onClick={() => setKind("rfp")}
              >
                Open call
              </button>
            </div>
            {kind === "grant" ? (
              <Field
                label="Grantee wallet address"
                tip="Approved payments are credited to this address and only it can withdraw them. Double-check every character."
              >
                <input
                  className="input input-bordered w-full font-mono"
                  placeholder="0x..."
                  value={grantee}
                  onChange={e => setGrantee(e.target.value.trim())}
                />
              </Field>
            ) : (
              <p className="text-sm leading-relaxed opacity-80">
                Funding comes first. When the goal is reached, anyone can offer to do the work and the committee votes
                on who. If they cannot agree within 30 days, everyone is refunded.
              </p>
            )}
          </Step>

          <Step n={3} title="Milestones and funding">
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
                className="btn btn-sm border-base-300 bg-base-100"
                disabled={rows.length >= MAX_MILESTONES}
                onClick={() => setRows([...rows, { title: "", amount: "" }])}
              >
                Add milestone ({rows.length} of {MAX_MILESTONES})
              </button>
            </div>
            <p className="font-medium tabular">
              Funding goal: {goal > 0n ? `${fmtAmount(goal)} ${TOKEN_SYMBOL}` : "-"}
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={`Funding period: ${days} days`}
                tip="How long people can contribute. If the goal is reached sooner, it starts right away."
              >
                <input
                  type="range"
                  min={1}
                  max={90}
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="range range-sm w-full"
                />
              </Field>
              <Field
                label={`Minimum to proceed: ${qualifyPct}% of goal`}
                tip="If the period ends between this and 100%, it goes ahead with every milestone scaled down in proportion. Below it, everyone is refunded."
              >
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={qualifyPct}
                  onChange={e => setQualifyPct(Number(e.target.value))}
                  className="range range-sm w-full"
                />
              </Field>
            </div>
          </Step>

          <Step n={4} title="Review committee">
            <p className="text-sm leading-relaxed opacity-70">
              These people decide whether each milestone was delivered. Pick people the backers will trust. If a
              majority of them agree, they can release money for work that was not done, and the contract cannot prevent
              that.
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
              tip="Must be a majority. A higher number makes approval harder to get, and rejection easier."
            >
              <input
                type="range"
                className="range range-sm w-full"
                min={Math.max(minThreshold, 1)}
                max={Math.max(reviewers.length, minThreshold)}
                value={effectiveThreshold}
                disabled={reviewers.length < MIN_REVIEWERS}
                onChange={e => setThreshold(Number(e.target.value))}
              />
            </Field>
          </Step>

          <Step n={5} title="Make it easier to trust (optional)">
            <Field
              label="Cover image link"
              hint="A picture shown on the card and at the top of the page. Must start with https://"
            >
              <input
                className="input input-bordered w-full"
                placeholder="https://..."
                maxLength={500}
                value={image}
                onChange={e => setImage(e.target.value)}
              />
            </Field>

            <div className="space-y-3">
              <div className="font-medium">Links</div>
              <p className="text-sm opacity-60">Website, repository, a past project. Up to {MAX_LINKS}.</p>
              {links.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                  <input
                    className="input input-bordered w-full"
                    placeholder="Name"
                    maxLength={40}
                    value={l.label}
                    onChange={e => setLinks(links.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))}
                    aria-label={`Link ${i + 1} name`}
                  />
                  <input
                    className="input input-bordered w-full"
                    placeholder="https://..."
                    maxLength={300}
                    value={l.url}
                    onChange={e => setLinks(links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))}
                    aria-label={`Link ${i + 1} address`}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setLinks(links.filter((_, k) => k !== i))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-sm border-base-300 bg-base-100"
                disabled={links.length >= MAX_LINKS}
                onClick={() => setLinks([...links, { label: "", url: "" }])}
              >
                Add link
              </button>
            </div>

            <div className="space-y-3">
              <div className="font-medium">Questions backers might ask</div>
              <p className="text-sm opacity-60">Up to {MAX_FAQ}. Shown on the initiative page.</p>
              {faq.map((f, i) => (
                <div key={i} className="space-y-2 border-l-2 border-base-300 pl-3">
                  <input
                    className="input input-bordered w-full"
                    placeholder="Question"
                    maxLength={160}
                    value={f.q}
                    onChange={e => setFaq(faq.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))}
                    aria-label={`Question ${i + 1}`}
                  />
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={2}
                    placeholder="Answer"
                    maxLength={600}
                    value={f.a}
                    onChange={e => setFaq(faq.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))}
                    aria-label={`Answer ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setFaq(faq.filter((_, k) => k !== i))}
                  >
                    Remove question
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-sm border-base-300 bg-base-100"
                disabled={faq.length >= MAX_FAQ}
                onClick={() => setFaq([...faq, { q: "", a: "" }])}
              >
                Add question
              </button>
            </div>
          </Step>

          {problems.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-error">
              {problems.map(p => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="btn btn-primary btn-lg"
              disabled={busy || problems.length > 0 || !usdc || !net}
              onClick={submit}
            >
              {busy ? <span className="loading loading-spinner" /> : "Create initiative"}
            </button>
            <p className="max-w-md text-sm opacity-60">
              This sends one transaction. Nothing is held until people contribute.
            </p>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold opacity-70">How the card will look</h2>
            <div className="surface overflow-hidden">
              <Cover image={image.trim().startsWith("https://") ? image.trim() : undefined} category={category} />
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm opacity-60">
                    {CATEGORIES[category]}
                    <ChainBadge chainId={chainId} />
                  </span>
                  <span className="badge badge-soft badge-info gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    Funding
                  </span>
                </div>
                <h3 className="text-lg font-semibold leading-snug line-clamp-2">{title.trim() || "Your title"}</h3>
                <p className="min-h-[3.75rem] text-sm opacity-70 line-clamp-3">
                  {summary.trim() || "Your summary appears here."}
                </p>
                <FundingBar raised={0n} goal={goal || 1n} qualifyBps={qualifyPct * 100} plan={previewPlan} compact />
                <div className="flex justify-between text-sm tabular">
                  <span>
                    <strong>0</strong> / {goal > 0n ? fmtAmount(goal) : "-"} {TOKEN_SYMBOL}
                  </span>
                  <span className="opacity-70">0 backers</span>
                </div>
              </div>
            </div>
          </div>

          <div className="surface space-y-3 p-5">
            <h2 className="font-semibold">Before you create</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed opacity-80">
              {CHECKLIST.map(c => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs leading-relaxed opacity-60">
            Your text is stored on the blockchain, where anyone can read it forever. Details size: {sizeKb.toFixed(1)}{" "}
            KB.{" "}
            {sizeKb > 8
              ? "That is large, and a larger size costs more in network fees. Consider shortening it."
              : "Longer text costs more in network fees."}
          </p>
        </aside>
      </div>
    </div>
  );
};

export default Create;
