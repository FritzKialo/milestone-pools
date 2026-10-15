"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import {
  type Initiative,
  REVIEW_PERIOD,
  SUBMISSION_WINDOW,
  TOKEN_SYMBOL,
  fmtAmount,
  safeLink,
  useNow,
} from "~~/lib/pools";

type Props = { item: Initiative; reviewers: `0x${string}`[] };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-base-300 p-4 space-y-3">
    <h3 className="font-semibold">{title}</h3>
    {children}
  </div>
);

type BtnProps = {
  k: string;
  label: string;
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>) => Promise<void>;
  onClick: () => Promise<unknown>;
  kind?: string;
  disabled?: boolean;
};

const Btn = ({ k, label, busy, run, onClick, kind = "btn-neutral", disabled }: BtnProps) => (
  <button className={`btn ${kind}`} disabled={!!busy || disabled} onClick={() => run(k, onClick)}>
    {busy === k ? <span className="loading loading-spinner loading-sm" /> : label}
  </button>
);

/** Everything the connected wallet can do on this initiative right now. */
export const ActionsPanel = ({ item, reviewers }: Props) => {
  const { address } = useAccount();
  const now = useNow(10_000);
  const id = BigInt(item.id);
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "MilestonePools" });
  const [busy, setBusy] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");

  const me = address?.toLowerCase();
  const isGrantee = !!me && item.grantee.toLowerCase() === me;
  const isReviewer = !!me && reviewers.some(r => r.toLowerCase() === me);

  const { data: voted } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "hasVoted",
    args: [id, item.reviewNo, address],
    watch: true,
  });
  const { data: refundable } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "refundableOf",
    args: [id, address],
    watch: true,
  });

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const sections: React.ReactNode[] = [];

  // Anyone: close out a funding window.
  if (item.status === "Funding" && now > item.fundingDeadline) {
    sections.push(
      <Section key="settle-f" title="The funding window has ended">
        <p className="text-sm opacity-80">
          Anyone can close it. If the minimum was reached the initiative goes ahead with what was raised; otherwise
          contributions become refundable.
        </p>
        <Btn
          busy={busy}
          run={run}
          k="settle"
          label="Close funding"
          onClick={() => writeContractAsync({ functionName: "settle", args: [id] })}
        />
      </Section>,
    );
  }

  // Anyone: close out a failed grantee selection.
  if (item.status === "Selecting" && now > item.selectionDeadline) {
    sections.push(
      <Section key="settle-s" title="Time to choose a grantee has run out">
        <p className="text-sm opacity-80">
          No candidate reached the required votes. Closing it makes contributions refundable.
        </p>
        <Btn
          busy={busy}
          run={run}
          k="settle"
          label="Close selection"
          onClick={() => writeContractAsync({ functionName: "settle", args: [id] })}
        />
      </Section>,
    );
  }

  // Grantee: submit evidence.
  if (isGrantee && item.status === "Active" && item.phase === "AwaitingSubmission") {
    const ok = !!safeLink(evidence.trim());
    sections.push(
      <Section key="submit" title={`Submit milestone ${item.currentMilestone + 1}`}>
        <p className="text-sm opacity-80">
          Link to your evidence of completed work (https:// or ipfs://). The committee has 14 days to vote. Attempt{" "}
          {item.submissionsForCurrent + 1} of 3.
        </p>
        <input
          className="input input-bordered w-full"
          placeholder="https://... or ipfs://..."
          value={evidence}
          onChange={e => setEvidence(e.target.value)}
          aria-label="Evidence link"
        />
        {evidence && !ok && <p className="text-sm text-error">Use a link that starts with https:// or ipfs://</p>}
        <Btn
          busy={busy}
          run={run}
          k="submit"
          kind="btn-primary"
          label="Submit for review"
          disabled={!ok}
          onClick={async () => {
            await writeContractAsync({ functionName: "submitMilestone", args: [id, evidence.trim()] });
            setEvidence("");
          }}
        />
      </Section>,
    );
  }

  // Reviewer: vote on a submitted milestone.
  if (isReviewer && item.status === "Active" && item.phase === "UnderReview") {
    const open = now <= item.reviewStartedAt + REVIEW_PERIOD;
    sections.push(
      <Section key="vote" title={`Vote on milestone ${item.currentMilestone + 1}`}>
        {voted ? (
          <p className="text-sm">You have voted on this submission.</p>
        ) : !open ? (
          <p className="text-sm opacity-80">The voting window has closed.</p>
        ) : (
          <>
            <p className="text-sm opacity-80">
              Check the evidence linked above. Approving credits this milestone&apos;s payment to the grantee, and it
              cannot be undone.
            </p>
            <div className="flex gap-2">
              <Btn
                busy={busy}
                run={run}
                k="approve"
                kind="btn-success"
                label="Approve"
                onClick={() => writeContractAsync({ functionName: "voteMilestone", args: [id, true] })}
              />
              <Btn
                busy={busy}
                run={run}
                k="reject"
                kind="btn-error btn-outline"
                label="Reject"
                onClick={() => writeContractAsync({ functionName: "voteMilestone", args: [id, false] })}
              />
            </div>
          </>
        )}
      </Section>,
    );
  }

  // Anyone: close a review nobody finished.
  if (item.status === "Active" && item.phase === "UnderReview" && now > item.reviewStartedAt + REVIEW_PERIOD) {
    sections.push(
      <Section key="expire" title="The voting window has ended">
        <p className="text-sm opacity-80">
          No decision was reached in time. Closing it counts as a rejected attempt and lets the grantee resubmit.
        </p>
        <Btn
          busy={busy}
          run={run}
          k="expire"
          label="Close review"
          onClick={() => writeContractAsync({ functionName: "expireReview", args: [id] })}
        />
      </Section>,
    );
  }

  // Anyone: cancel an idle grantee.
  if (item.status === "Active" && item.phase === "AwaitingSubmission" && now > item.lastActivity + SUBMISSION_WINDOW) {
    sections.push(
      <Section key="idle" title="The grantee has been silent for 60 days">
        <p className="text-sm opacity-80">
          Anyone can cancel it. The part not yet paid out becomes refundable to backers.
        </p>
        <Btn
          busy={busy}
          run={run}
          k="idle"
          label="Cancel for inactivity"
          onClick={() => writeContractAsync({ functionName: "cancelIdle", args: [id] })}
        />
      </Section>,
    );
  }

  // Funder: claim a refund.
  if ((item.status === "Failed" || item.status === "Cancelled") && refundable && refundable > 0n) {
    sections.push(
      <Section key="refund" title="You have a refund waiting">
        <p className="text-sm opacity-80">
          Your share of the unspent funds: <strong>{fmtAmount(refundable)}</strong> {TOKEN_SYMBOL}.
        </p>
        <Btn
          busy={busy}
          run={run}
          k="refund"
          kind="btn-primary"
          label="Claim refund"
          onClick={() => writeContractAsync({ functionName: "refund", args: [id] })}
        />
      </Section>,
    );
  }

  if (sections.length === 0) return null;
  return <div className="space-y-4">{sections}</div>;
};
