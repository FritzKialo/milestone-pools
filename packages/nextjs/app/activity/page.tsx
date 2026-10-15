"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount, useReadContracts } from "wagmi";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { type Listing, TOKEN_SYMBOL, fmtAmount, useListings, useMetadata } from "~~/lib/pools";

const Row = ({ item, note, action }: { item: Listing; note: string; action?: React.ReactNode }) => {
  const meta = useMetadata(item.metadataURI, item.id);
  return (
    <li className="py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Link href={`/initiative/${item.id}`} className="font-medium link link-hover">
          {meta.title}
        </Link>
        <div className="text-sm opacity-70">{note}</div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={item.status} />
        {action}
      </div>
    </li>
  );
};

const Group = ({
  title,
  empty,
  children,
  count,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
  count: number;
}) => (
  <section>
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    {count === 0 ? (
      <p className="text-sm opacity-70">{empty}</p>
    ) : (
      <ul className="divide-y divide-base-300 border-y border-base-300">{children}</ul>
    )}
  </section>
);

const Activity: NextPage = () => {
  const { address } = useAccount();
  const { listings, isLoading } = useListings();
  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const { data: usdc } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "MilestonePools" });
  const [busy, setBusy] = useState<string | null>(null);

  const { data: credit } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "credits",
    args: [usdc?.address, address],
    watch: true,
  });

  const enabled = !!pools && !!address && listings.length > 0;
  const { data: backed } = useReadContracts({
    contracts: (enabled
      ? listings.flatMap(l => [
          { address: pools.address, abi: pools.abi, functionName: "contributions", args: [BigInt(l.id), address] },
          { address: pools.address, abi: pools.abi, functionName: "refundableOf", args: [BigInt(l.id), address] },
          {
            address: pools.address,
            abi: pools.abi,
            functionName: "hasVoted",
            args: [BigInt(l.id), l.reviewNo, address],
          },
        ])
      : []) as any,
    query: { enabled, refetchInterval: 5000 },
  });

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center space-y-2">
        <h1 className="text-2xl font-bold">Connect a wallet to see your activity</h1>
      </div>
    );
  }

  const me = address.toLowerCase();
  const val = (i: number, k: number) => {
    const r = backed?.[i * 3 + k];
    return r?.status === "success" ? r.result : undefined;
  };

  const mine = listings.map((l, i) => ({
    l,
    contributed: (val(i, 0) as bigint | undefined) ?? 0n,
    refundable: (val(i, 1) as bigint | undefined) ?? 0n,
    voted: val(i, 2) === true,
  }));

  const backedList = mine.filter(m => m.contributed > 0n);
  const created = listings.filter(l => l.proposer.toLowerCase() === me);
  const delivering = listings.filter(l => l.grantee.toLowerCase() === me);
  const committee = mine.filter(m => m.l.reviewers.some(r => r.toLowerCase() === me));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-10">
      <h1 className="text-3xl font-bold">My activity</h1>

      <section className="border border-base-300 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm opacity-60">Ready to withdraw</div>
          <div className="text-2xl font-semibold">
            {fmtAmount(credit ?? 0n)} {TOKEN_SYMBOL}
          </div>
          <div className="text-sm opacity-70">
            Approved milestone payments are credited here. You choose when to withdraw.
          </div>
        </div>
        <button
          className="btn btn-primary"
          disabled={!credit || credit === 0n || !!busy || !usdc}
          onClick={() => run("withdraw", () => writeContractAsync({ functionName: "withdraw", args: [usdc?.address] }))}
        >
          {busy === "withdraw" ? <span className="loading loading-spinner loading-sm" /> : "Withdraw"}
        </button>
      </section>

      {isLoading ? (
        <span className="loading loading-spinner" />
      ) : (
        <>
          <Group
            title="Initiatives I backed"
            count={backedList.length}
            empty="You have not contributed to anything yet."
          >
            {backedList.map(m => (
              <Row
                key={m.l.id}
                item={m.l}
                note={`You contributed ${fmtAmount(m.contributed)} ${TOKEN_SYMBOL}${
                  m.refundable > 0n ? `. Refund available: ${fmtAmount(m.refundable)} ${TOKEN_SYMBOL}` : ""
                }`}
                action={
                  m.refundable > 0n ? (
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={!!busy}
                      onClick={() =>
                        run(`refund${m.l.id}`, () =>
                          writeContractAsync({ functionName: "refund", args: [BigInt(m.l.id)] }),
                        )
                      }
                    >
                      {busy === `refund${m.l.id}` ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        "Claim refund"
                      )}
                    </button>
                  ) : undefined
                }
              />
            ))}
          </Group>

          <Group title="Initiatives I created" count={created.length} empty="You have not created any.">
            {created.map(l => (
              <Row key={l.id} item={l} note={`${fmtAmount(l.raised)} of ${fmtAmount(l.goal)} ${TOKEN_SYMBOL} raised`} />
            ))}
          </Group>

          <Group title="Work I am delivering" count={delivering.length} empty="You are not the grantee of anything.">
            {delivering.map(l => (
              <Row
                key={l.id}
                item={l}
                note={
                  l.status === "Active"
                    ? l.phase === "AwaitingSubmission"
                      ? `Milestone ${l.currentMilestone + 1} is waiting for your evidence`
                      : `Milestone ${l.currentMilestone + 1} is under review`
                    : `${fmtAmount(l.released)} ${TOKEN_SYMBOL} paid out so far`
                }
              />
            ))}
          </Group>

          <Group title="Initiatives I review" count={committee.length} empty="You are not on any review committee.">
            {committee.map(m => {
              const needsVote = m.l.status === "Active" && m.l.phase === "UnderReview" && !m.voted;
              const selecting = m.l.status === "Selecting";
              return (
                <Row
                  key={m.l.id}
                  item={m.l}
                  note={
                    needsVote
                      ? "A milestone is waiting for your vote"
                      : selecting
                        ? "Choose a grantee"
                        : "Nothing needs you right now"
                  }
                  action={
                    needsVote || selecting ? (
                      <Link href={`/initiative/${m.l.id}`} className="btn btn-sm btn-neutral">
                        Open
                      </Link>
                    ) : undefined
                  }
                />
              );
            })}
          </Group>
        </>
      )}
    </div>
  );
};

export default Activity;
