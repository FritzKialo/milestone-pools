"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useReadContracts } from "wagmi";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { ActionsPanel } from "~~/components/pools/ActionsPanel";
import { ActivityLog } from "~~/components/pools/ActivityLog";
import { AddressLine } from "~~/components/pools/AddressLine";
import { CalendarButton } from "~~/components/pools/CalendarButton";
import { ChainBadge } from "~~/components/pools/ChainBadge";
import { StepChart } from "~~/components/pools/Charts";
import { ContractLink } from "~~/components/pools/ContractLink";
import { ContributeBox } from "~~/components/pools/ContributeBox";
import { Cover } from "~~/components/pools/Cover";
import { FaqList } from "~~/components/pools/FaqList";
import { FundingBar } from "~~/components/pools/FundingBar";
import { Hint } from "~~/components/pools/Hint";
import { MilestoneTimeline } from "~~/components/pools/MilestoneTimeline";
import { PayoutSimulator } from "~~/components/pools/PayoutSimulator";
import { RfpPanel } from "~~/components/pools/RfpPanel";
import { RiskPanel } from "~~/components/pools/RiskPanel";
import { SaveButton } from "~~/components/pools/SaveButton";
import { ShareButton } from "~~/components/pools/ShareButton";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import { TopBackers } from "~~/components/pools/TopBackers";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { buildChecks, describeRecord, reviewerRecords } from "~~/lib/analysis";
import { DEFAULT_POOL_CHAIN, parseInitiativeRef, poolChain, uidOf } from "~~/lib/chains";
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
import { cumulative, topBackers, useContributions } from "~~/lib/stats";

const InitiativePage: NextPage<{ params: Promise<{ id: string }> }> = ({ params }) => {
  const { id: idParam } = use(params);
  const ref = parseInitiativeRef(idParam);
  const valid = !!ref;
  const idNum = ref?.id ?? 1;
  const chainId = ref?.chainId ?? DEFAULT_POOL_CHAIN?.id ?? 0;
  const uid = uidOf(chainId, idNum);
  const pools = poolChain(chainId)?.pools;
  const id = BigInt(idNum);
  const now = useNow(15_000);

  const { data: raw, isLoading } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "getInitiative",
    chainId,
    args: [id],
    watch: true,
    query: { enabled: valid },
  });
  const { data: plan } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "getMilestoneAmounts",
    chainId,
    args: [id],
    watch: true,
    query: { enabled: valid },
  });
  const { data: reviewersRaw } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "getReviewers",
    chainId,
    args: [id],
    query: { enabled: valid },
  });
  const { data: events } = usePoolEvents();
  const { data: allContributions } = useContributions();

  const reviewers = ((reviewersRaw as readonly `0x${string}`[] | undefined) ?? []) as `0x${string}`[];
  const item = raw ? normalise(chainId, idNum, raw) : undefined;
  const metadataURI = (eventsFor(events, "InitiativeDetails", uid)[0]?.args.metadataURI as string | undefined) ?? "";
  const meta = useMetadata(metadataURI, idNum);
  const category = Number(eventsFor(events, "InitiativeCreated", uid)[0]?.args.category ?? CATEGORIES.length - 1);

  const mine = allContributions.filter(c => c.uid === uid);
  const series = useMemo(() => cumulative(mine), [mine]);
  const backers = useMemo(() => topBackers(mine, 5), [mine]);
  const records = useMemo(() => reviewerRecords(events), [events]);

  // Review progress per committee member for the open review.
  const { data: votes } = useReadContracts({
    contracts: (pools && item
      ? reviewers.map(r => ({
          chainId,
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

  const planArr = [...(plan as readonly bigint[])];
  const evidence = eventsFor(events, "MilestoneSubmitted", uid)
    .filter(e => Number(e.args.milestone) === item.currentMilestone)
    .map(e => e.args.evidenceURI as string)
    .pop();
  const underReview = item.status === "Active" && item.phase === "UnderReview";
  const qualified = isQualified(item);
  const isOpen = item.status === "Funding" && now <= item.fundingDeadline;

  const topSharePct = item.raised > 0n && backers[0] ? Number((backers[0].total * 1000n) / item.raised) / 10 : null;
  const checks = buildChecks({ item, plan: planArr, reviewers, topSharePct, now });

  const nav = [
    { href: "#about", label: "About", show: true },
    { href: "#milestones", label: "Milestones", show: true },
    { href: "#committee", label: "Committee", show: true },
    { href: "#checks", label: "Before you contribute", show: true },
    { href: "#backers", label: "Backers", show: true },
    { href: "#faq", label: "Questions", show: !!meta.faq },
    { href: "#activity", label: "Activity", show: true },
  ].filter(n => n.show);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/explore" className="link text-sm opacity-70">
        &larr; All initiatives
      </Link>

      <div className="surface mt-4 overflow-hidden">
        <Cover image={meta.image} category={category} className="h-32 sm:h-56" />
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="badge badge-ghost">{CATEGORIES[category] ?? "Other"}</span>
            <ChainBadge chainId={chainId} className="rounded-full border border-base-300 px-2 py-1" />
            {item.isRfp && <span className="badge badge-outline">Open call</span>}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="max-w-3xl text-2xl font-bold leading-tight sm:text-3xl">{meta.title}</h1>
            <div className="flex gap-2">
              <CalendarButton item={item} title={meta.title} now={now} />
              <SaveButton uid={uid} label />
              <ShareButton />
            </div>
          </div>
          {meta.summary && <p className="max-w-3xl text-base opacity-80 sm:text-lg">{meta.summary}</p>}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="opacity-60">Proposed by</span>
              <AddressLine address={item.proposer} chainId={chainId} />
              <Link href={`/profile/${item.proposer}`} className="link opacity-70">
                Profile
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-60">Grantee</span>
              {item.isRfp ? (
                <span>To be chosen by the committee</span>
              ) : (
                <AddressLine address={item.grantee} chainId={chainId} />
              )}
            </div>
            <ContractLink name="MilestonePools" label="Contract" chainId={chainId} className="text-sm" />
          </div>
        </div>
      </div>

      <nav className="my-6 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="On this page">
        {nav.map(n => (
          <a key={n.href} href={n.href} className="link opacity-70 hover:opacity-100">
            {n.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-12">
          <section id="about" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-semibold">About</h2>
            {meta.body ? (
              <p className="prose-block whitespace-pre-wrap">{meta.body}</p>
            ) : (
              <p className="text-sm opacity-70">The creator did not add further details.</p>
            )}
            {meta.links && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {meta.links.map(l => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-sm gap-1.5 border-base-300 bg-base-100"
                    >
                      {l.label}
                      <ArrowUpRightIcon className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {item.status === "Selecting" && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Choosing the grantee</h2>
              <RfpPanel item={item} reviewers={reviewers} />
            </section>
          )}

          <section id="milestones" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-semibold">Milestones</h2>
            {item.status === "Funding" && item.raised < item.goal && (
              <p className="text-sm opacity-70">
                If funding ends below the goal but above the minimum, every milestone is scaled down in proportion to
                what was raised.
              </p>
            )}
            <MilestoneTimeline
              item={item}
              plan={planArr}
              titles={meta.milestones}
              evidenceURI={underReview ? evidence : undefined}
            />
          </section>

          <section id="committee" className="scroll-mt-24 space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              Review committee
              <Hint text="These wallets decide if each milestone was delivered. They were chosen by the creator and cannot be changed." />
            </h2>
            <p className="text-sm opacity-70">
              {item.threshold} of {item.reviewerCount} must approve each milestone. The committee is fixed when the
              initiative is created and cannot be changed.
            </p>
            <ul className="surface divide-y divide-base-300">
              {reviewers.map((r, k) => {
                const voted = underReview && votes?.[k]?.status === "success" && votes[k].result === true;
                return (
                  <li key={r} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 space-y-0.5">
                      <AddressLine address={r} chainId={chainId} />
                      <p className="pl-8 text-xs opacity-60">{describeRecord(records.get(r.toLowerCase()))}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href={`/profile/${r}`} className="link text-sm opacity-70">
                        Profile
                      </Link>
                      {underReview && (
                        <span className={`badge badge-soft ${voted ? "badge-success" : ""}`}>
                          {voted ? "Voted" : "Not yet voted"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {underReview && (
              <p className="text-xs opacity-60">
                Voting closes {fmtDateTime(item.reviewStartedAt + REVIEW_PERIOD)}. A vote&apos;s direction is recorded
                in the activity log below.
              </p>
            )}
          </section>

          <section id="checks" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-semibold">Before you contribute</h2>
            <RiskPanel checks={checks} />
          </section>

          <section id="backers" className="scroll-mt-24 space-y-6">
            <h2 className="text-xl font-semibold">Backers</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="surface space-y-3 p-5">
                <h3 className="font-semibold">Pooled over time</h3>
                <StepChart points={series} height={170} label={`Total pooled in ${TOKEN_SYMBOL} over time`} />
              </div>
              <div className="surface space-y-3 p-5">
                <h3 className="font-semibold">Largest backers</h3>
                <TopBackers backers={backers} total={item.raised} />
              </div>
            </div>
          </section>

          {meta.faq && (
            <section id="faq" className="scroll-mt-24 space-y-3">
              <h2 className="text-xl font-semibold">Questions from the creator</h2>
              <FaqList items={meta.faq.map(f => ({ q: f.q, a: <p className="whitespace-pre-wrap">{f.a}</p> }))} />
            </section>
          )}

          <section id="activity" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-semibold">Activity</h2>
            <ActivityLog uid={uid} />
          </section>
        </div>

        {/* On phones and tablets the funding box comes first, so people see progress and can contribute without scrolling past everything. */}
        <aside className="order-first space-y-6 lg:sticky lg:top-24 lg:order-none lg:self-start">
          <div className="surface space-y-5 p-5">
            <FundingBar
              raised={item.raised}
              goal={item.goal}
              qualifyBps={item.qualifyBps}
              plan={planArr}
              status={item.status}
              currentMilestone={item.currentMilestone}
              phase={item.phase}
            />
            <dl className="grid grid-cols-2 gap-y-2 text-sm tabular">
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
                  <dt className="opacity-60">
                    Will it go ahead?{" "}
                    <Hint
                      text={`It goes ahead if at least ${item.qualifyBps / 100}% of the goal is raised by the deadline. Below that, everyone is refunded.`}
                    />
                  </dt>
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
            {isOpen && <ContributeBox item={item} />}
            {isOpen && <PayoutSimulator item={item} plan={planArr} />}
            {!isOpen && item.status === "Funding" && (
              <p className="text-sm opacity-70">
                The funding period has ended. Anyone can close it, which decides whether this goes ahead.
              </p>
            )}
          </div>

          <ActionsPanel item={item} reviewers={reviewers} />

          <p className="text-xs leading-relaxed opacity-60">
            Contributions go to a smart contract, not to the creator. Read the{" "}
            <Link href="/terms" className="link">
              risks
            </Link>{" "}
            before contributing.
          </p>
        </aside>
      </div>
    </div>
  );
};

const Notice = ({ title }: { title: string }) => (
  <div className="mx-auto max-w-xl space-y-4 px-4 py-24 text-center">
    <h1 className="text-2xl font-bold">{title}</h1>
    <Link href="/explore" className="btn btn-primary">
      Back to Explore
    </Link>
  </div>
);

export default InitiativePage;
