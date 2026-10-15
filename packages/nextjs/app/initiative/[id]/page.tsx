"use client";

import { use } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useReadContracts } from "wagmi";
import { ActionsPanel } from "~~/components/pools/ActionsPanel";
import { ActivityLog } from "~~/components/pools/ActivityLog";
import { ContributeBox } from "~~/components/pools/ContributeBox";
import { FundingBar } from "~~/components/pools/FundingBar";
import { MilestoneTimeline } from "~~/components/pools/MilestoneTimeline";
import { RfpPanel } from "~~/components/pools/RfpPanel";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import { useDeployedContractInfo, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import {
  CATEGORIES,
  REVIEW_PERIOD,
  TOKEN_SYMBOL,
  eventsFor,
  fmtAmount,
  fmtDateTime,
  isQualified,
  normalise,
  timeLeft,
  useMetadata,
  useNow,
  usePoolEvents,
} from "~~/lib/pools";

const InitiativePage: NextPage<{ params: Promise<{ id: string }> }> = ({ params }) => {
  const { id: idParam } = use(params);
  const idNum = Number(idParam);
  const valid = Number.isInteger(idNum) && idNum > 0;
  const id = BigInt(valid ? idNum : 1);
  const { targetNetwork } = useTargetNetwork();
  const now = useNow(15_000);

  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const { data: raw, isLoading } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "getInitiative",
    args: [id],
    watch: true,
    query: { enabled: valid },
  });
  const { data: plan } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "getMilestoneAmounts",
    args: [id],
    watch: true,
    query: { enabled: valid },
  });
  const { data: reviewersRaw } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "getReviewers",
    args: [id],
    query: { enabled: valid },
  });
  const { data: events } = usePoolEvents();

  const reviewers = ((reviewersRaw as readonly `0x${string}`[] | undefined) ?? []) as `0x${string}`[];
  const item = raw ? normalise(idNum, raw) : undefined;
  const metadataURI = (eventsFor(events, "InitiativeDetails", idNum)[0]?.args.metadataURI as string | undefined) ?? "";
  const meta = useMetadata(metadataURI, idNum);
  const category = Number(eventsFor(events, "InitiativeCreated", idNum)[0]?.args.category ?? CATEGORIES.length - 1);

  // Review progress per committee member for the open review.
  const { data: votes } = useReadContracts({
    contracts: (pools && item
      ? reviewers.map(r => ({
          address: pools.address,
          abi: pools.abi,
          functionName: "hasVoted",
          args: [id, item.reviewNo, r],
        }))
      : []) as any,
    query: { enabled: !!pools && !!item && reviewers.length > 0, refetchInterval: 5000 },
  });

  if (!valid) {
    return <Notice title="That initiative does not exist" />;
  }
  if (isLoading || !item || !plan) {
    return (
      <div className="flex justify-center py-24">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const planArr = plan as readonly bigint[];
  const evidence = eventsFor(events, "MilestoneSubmitted", idNum)
    .filter(e => Number(e.args.milestone) === item.currentMilestone)
    .map(e => e.args.evidenceURI as string)
    .pop();
  const underReview = item.status === "Active" && item.phase === "UnderReview";
  const qualified = isQualified(item);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/explore" className="link text-sm opacity-70">
        &larr; All initiatives
      </Link>

      <div className="mt-3 mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.status} />
          <span className="badge badge-ghost">{CATEGORIES[category] ?? "Other"}</span>
          {item.isRfp && <span className="badge badge-outline">Open call</span>}
        </div>
        <h1 className="text-3xl font-bold leading-tight">{meta.title}</h1>
        {meta.summary && <p className="text-lg opacity-80 max-w-3xl">{meta.summary}</p>}
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="opacity-60">Proposed by</span>
            <Address address={item.proposer} chain={targetNetwork} />
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-60">Grantee</span>
            {item.isRfp ? (
              <span>To be chosen by the committee</span>
            ) : (
              <Address address={item.grantee} chain={targetNetwork} />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10 min-w-0">
          {meta.body && (
            <section>
              <h2 className="text-xl font-semibold mb-3">About</h2>
              <p className="whitespace-pre-wrap leading-relaxed">{meta.body}</p>
            </section>
          )}

          {item.status === "Selecting" && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Choosing the grantee</h2>
              <RfpPanel item={item} reviewers={reviewers} />
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold mb-1">Milestones</h2>
            {item.status === "Funding" && item.raised < item.goal && (
              <p className="text-sm opacity-70 mb-4">
                If funding ends below the goal but above the minimum, every milestone is scaled down in proportion to
                what was raised.
              </p>
            )}
            <div className="mt-4">
              <MilestoneTimeline
                item={item}
                plan={[...planArr]}
                titles={meta.milestones}
                evidenceURI={underReview ? evidence : undefined}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-1">Review committee</h2>
            <p className="text-sm opacity-70 mb-3">
              {item.threshold} of {item.reviewerCount} must approve each milestone. The committee is fixed when the
              initiative is created and cannot be changed.
            </p>
            <ul className="divide-y divide-base-300 border border-base-300">
              {reviewers.map((r, k) => {
                const voted = underReview && votes?.[k]?.status === "success" && votes[k].result === true;
                return (
                  <li key={r} className="p-3 flex items-center justify-between gap-3">
                    <Address address={r} chain={targetNetwork} />
                    {underReview && (
                      <span className={`badge ${voted ? "badge-success" : "badge-ghost"}`}>
                        {voted ? "Voted" : "Not yet voted"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {underReview && (
              <p className="text-xs opacity-60 mt-2">
                Voting closes {fmtDateTime(item.reviewStartedAt + REVIEW_PERIOD)}. A vote&apos;s direction is recorded
                in the activity log below.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Activity</h2>
            <ActivityLog id={idNum} />
          </section>
        </div>

        <aside className="space-y-6">
          <div className="border border-base-300 p-5 space-y-4">
            <FundingBar raised={item.raised} goal={item.goal} qualifyBps={item.qualifyBps} />
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="opacity-60">Backers</dt>
              <dd className="text-right">{item.backers}</dd>
              <dt className="opacity-60">Paid out so far</dt>
              <dd className="text-right">
                {fmtAmount(item.released)} {TOKEN_SYMBOL}
              </dd>
              {item.status === "Funding" && (
                <>
                  <dt className="opacity-60">Funding ends</dt>
                  <dd className="text-right">{timeLeft(item.fundingDeadline, now)}</dd>
                  <dt className="opacity-60">Will it go ahead?</dt>
                  <dd className="text-right">{qualified ? "Yes, minimum reached" : "Not yet"}</dd>
                </>
              )}
              {(item.status === "Failed" || item.status === "Cancelled") && (
                <>
                  <dt className="opacity-60">Refundable pool</dt>
                  <dd className="text-right">
                    {fmtAmount(item.refundPool)} {TOKEN_SYMBOL}
                  </dd>
                </>
              )}
            </dl>
            {item.status === "Funding" && now <= item.fundingDeadline && <ContributeBox item={item} />}
          </div>

          <ActionsPanel item={item} reviewers={reviewers} />
        </aside>
      </div>
    </div>
  );
};

const Notice = ({ title }: { title: string }) => (
  <div className="mx-auto max-w-xl px-4 py-24 text-center space-y-4">
    <h1 className="text-2xl font-bold">{title}</h1>
    <Link href="/explore" className="btn btn-primary">
      Back to Explore
    </Link>
  </div>
);

export default InitiativePage;
