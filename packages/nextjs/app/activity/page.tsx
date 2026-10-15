"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount, useReadContracts } from "wagmi";
import {
  ArrowDownTrayIcon,
  ArrowUpRightIcon,
  BellAlertIcon,
  ClipboardDocumentIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { CategoryIcon } from "~~/components/pools/Cover";
import { FeedList } from "~~/components/pools/FeedList";
import { FundingBar } from "~~/components/pools/FundingBar";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import { BlockieAvatar, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import {
  useCopyToClipboard,
  useDeployedContractInfo,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import { downloadCsv } from "~~/lib/csv";
import { useFeed, useTitleMap } from "~~/lib/feed";
import {
  CATEGORIES,
  type Listing,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  fmtAmount,
  shortAddr,
  useListings,
  useMetadata,
} from "~~/lib/pools";

type Tab = "backed" | "created" | "delivering" | "reviewing";

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "backed", label: "Backed", empty: "You have not contributed to anything yet." },
  { key: "created", label: "Created", empty: "You have not created any initiative." },
  { key: "delivering", label: "Delivering", empty: "You are not the grantee of anything." },
  { key: "reviewing", label: "Reviewing", empty: "You are not on any review committee." },
];

const Row = ({ item, note, action }: { item: Listing; note: string; action?: React.ReactNode }) => {
  const meta = useMetadata(item.metadataURI, item.id);
  return (
    <li className="relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-base-200/50 sm:flex-row sm:items-center sm:gap-4">
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/60 sm:flex">
        <CategoryIcon category={item.category} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/initiative/${item.id}`}
            className="font-medium after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {meta.title}
          </Link>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-sm tabular opacity-70">
          {CATEGORIES[item.category] ?? "Other"}. {note}
        </p>
        <div className="max-w-sm">
          <FundingBar
            raised={item.raised}
            goal={item.goal}
            qualifyBps={item.qualifyBps}
            plan={item.plan}
            status={item.status}
            currentMilestone={item.currentMilestone}
            phase={item.phase}
            compact
          />
        </div>
      </div>
      {action && <div className="relative z-10 shrink-0">{action}</div>}
    </li>
  );
};

const Tile = ({ value, label, note }: { value: string; label: string; note?: string }) => (
  <div className="surface tile p-4">
    <div className="text-xl font-semibold tabular sm:text-2xl">{value}</div>
    <div className="mt-0.5 text-sm opacity-70">{label}</div>
    {note && <div className="mt-0.5 text-xs opacity-50">{note}</div>}
  </div>
);

type Todo = { key: string; text: string; action: React.ReactNode };

const Activity: NextPage = () => {
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  const { listings, isLoading } = useListings();
  const title = useTitleMap();
  const { items: feed } = useFeed(10, undefined, address);
  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const { data: usdc } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "MilestonePools" });
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

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
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
        <div className="glass tile space-y-6 p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockClosedIcon className="h-7 w-7" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Connect a wallet to see your activity</h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed opacity-75">
              This page reads from the contract using your wallet address. Nothing is stored about you, and connecting
              does not cost anything.
            </p>
          </div>
          <ul className="mx-auto grid max-w-md gap-2 text-left text-sm sm:grid-cols-2">
            {[
              "What you backed, and any refund waiting",
              "Payments ready to withdraw",
              "Milestones that need your vote",
              "Work you created or deliver",
            ].map(t => (
              <li key={t} className="rounded-lg bg-base-200/60 px-3 py-2 opacity-85">
                {t}
              </li>
            ))}
          </ul>
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
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

  const totalBacked = backedList.reduce((s, m) => s + m.contributed, 0n);
  const totalRefundable = backedList.reduce((s, m) => s + m.refundable, 0n);
  const withdrawable = credit ?? 0n;

  const claimRefund = (id: number) =>
    run(`refund${id}`, () => writeContractAsync({ functionName: "refund", args: [BigInt(id)] }));

  const todos: Todo[] = [
    ...backedList
      .filter(m => m.refundable > 0n)
      .map(m => ({
        key: `refund${m.l.id}`,
        text: `Claim your ${fmtAmount(m.refundable)} ${TOKEN_SYMBOL} refund from ${title(m.l.id)}`,
        action: (
          <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => claimRefund(m.l.id)}>
            {busy === `refund${m.l.id}` ? <span className="loading loading-spinner loading-xs" /> : "Claim refund"}
          </button>
        ),
      })),
    ...committee
      .filter(m => m.l.status === "Active" && m.l.phase === "UnderReview" && !m.voted)
      .map(m => ({
        key: `vote${m.l.id}`,
        text: `Vote on milestone ${m.l.currentMilestone + 1} of ${title(m.l.id)}`,
        action: (
          <Link href={`/initiative/${m.l.id}`} className="btn btn-sm btn-primary">
            Open
          </Link>
        ),
      })),
    ...committee
      .filter(m => m.l.status === "Selecting")
      .map(m => ({
        key: `select${m.l.id}`,
        text: `Choose a grantee for ${title(m.l.id)}`,
        action: (
          <Link href={`/initiative/${m.l.id}`} className="btn btn-sm btn-primary">
            Open
          </Link>
        ),
      })),
    ...delivering
      .filter(l => l.status === "Active" && l.phase === "AwaitingSubmission")
      .map(l => ({
        key: `evidence${l.id}`,
        text: `Submit evidence for milestone ${l.currentMilestone + 1} of ${title(l.id)}`,
        action: (
          <Link href={`/initiative/${l.id}`} className="btn btn-sm btn-primary">
            Open
          </Link>
        ),
      })),
  ];

  const counts: Record<Tab, number> = {
    backed: backedList.length,
    created: created.length,
    delivering: delivering.length,
    reviewing: committee.length,
  };
  const current: Tab = tab ?? TABS.find(t => counts[t.key] > 0)?.key ?? "backed";
  const currentTab = TABS.find(t => t.key === current)!;

  const deliveringNote = (l: Listing) =>
    l.status === "Active"
      ? l.phase === "AwaitingSubmission"
        ? `Milestone ${l.currentMilestone + 1} is waiting for your evidence`
        : `Milestone ${l.currentMilestone + 1} is under review`
      : `${fmtAmount(l.released)} ${TOKEN_SYMBOL} paid out so far`;

  const exportCsv = () =>
    downloadCsv("my-milestone-pools-activity.csv", [
      ["initiative", "title", "my role", "status", `contributed (${TOKEN_SYMBOL})`, `refundable (${TOKEN_SYMBOL})`],
      ...backedList.map(m => [
        m.l.id,
        title(m.l.id),
        "backer",
        m.l.status,
        Number(m.contributed) / 10 ** TOKEN_DECIMALS,
        Number(m.refundable) / 10 ** TOKEN_DECIMALS,
      ]),
      ...created.map(l => [l.id, title(l.id), "creator", l.status, "", ""]),
      ...delivering.map(l => [l.id, title(l.id), "grantee", l.status, "", ""]),
      ...committee.map(m => [m.l.id, title(m.l.id), "reviewer", m.l.status, "", ""]),
    ]);

  const explorer = targetNetwork.blockExplorers?.default.url;
  const nothingAtAll = !isLoading && backedList.length + created.length + delivering.length + committee.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <header className="glass flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="shrink-0 overflow-hidden rounded-full ring-2 ring-base-300">
            <BlockieAvatar address={address} size={56} />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold">My activity</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-75">
              <span className="font-mono">{shortAddr(address)}</span>
              <span className="badge badge-soft badge-info badge-sm">{targetNetwork.name}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm border-base-300 bg-base-100"
            onClick={() => copyToClipboard(address)}
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            {isCopiedToClipboard ? "Copied" : "Copy address"}
          </button>
          <Link href={`/profile/${address}`} className="btn btn-sm border-base-300 bg-base-100">
            Public profile
          </Link>
          {explorer && (
            <a
              className="btn btn-sm border-base-300 bg-base-100"
              href={`${explorer}/address/${address}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Explorer
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </header>

      <section className="glass tile flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
        <div className="space-y-1">
          <div className="text-sm opacity-70">Ready to withdraw</div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="gold-text tabular text-4xl font-bold leading-none sm:text-5xl">
              {fmtAmount(withdrawable)}
            </span>
            <span className="text-lg font-semibold text-primary">{TOKEN_SYMBOL}</span>
          </div>
          <p className="max-w-md text-sm opacity-70">
            Approved milestone payments are credited here. Nothing is sent until you withdraw, and you choose when.
          </p>
        </div>
        <button
          className="btn btn-primary btn-glow btn-lg"
          disabled={withdrawable === 0n || !!busy || !usdc}
          onClick={() => run("withdraw", () => writeContractAsync({ functionName: "withdraw", args: [usdc?.address] }))}
        >
          {busy === "withdraw" ? <span className="loading loading-spinner loading-sm" /> : "Withdraw"}
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Summary">
        <Tile
          value={`${fmtAmount(totalBacked, 0)}`}
          label={`${TOKEN_SYMBOL} backed`}
          note={`${backedList.length} initiatives`}
        />
        <Tile value={`${fmtAmount(totalRefundable, 0)}`} label={`${TOKEN_SYMBOL} refundable`} />
        <Tile value={todos.length.toString()} label="Waiting on you" />
        <Tile value={created.length.toString()} label="Created" />
        <Tile value={delivering.length.toString()} label="Delivering" />
        <Tile value={committee.length.toString()} label="Reviewing" />
      </section>

      {todos.length > 0 && (
        <section className="surface space-y-3 border-primary/40 p-5" aria-label="Needs your attention">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BellAlertIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            Needs your attention
            <span className="badge badge-primary badge-sm">{todos.length}</span>
          </h2>
          <ul className="divide-y divide-base-300">
            {todos.map(t => (
              <li key={t.key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1">{t.text}</span>
                {t.action}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : nothingAtAll ? (
        <section className="surface border-dashed p-10 text-center">
          <p className="font-medium">Nothing here yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm opacity-70">
            Back an initiative, start your own, or get added to a review committee, and it will show up on this page.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/explore" className="btn btn-primary btn-sm">
              Explore initiatives
            </Link>
            <Link href="/create" className="btn btn-sm border-base-300 bg-base-100">
              Start one
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="My initiatives">
              {TABS.map(t => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={current === t.key}
                  className={`btn btn-sm ${current === t.key ? "btn-primary" : "border-base-300 bg-base-100 hover:bg-base-200"}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  <span className="opacity-60">{counts[t.key]}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-sm border-base-300 bg-base-100" onClick={exportCsv}>
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          {counts[current] === 0 ? (
            <p className="surface p-6 text-sm opacity-70">{currentTab.empty}</p>
          ) : (
            <ul className="surface divide-y divide-base-300 overflow-hidden" key={current}>
              {current === "backed" &&
                backedList.map(m => (
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
                          onClick={() => claimRefund(m.l.id)}
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
              {current === "created" &&
                created.map(l => (
                  <Row
                    key={l.id}
                    item={l}
                    note={`${fmtAmount(l.raised)} of ${fmtAmount(l.goal)} ${TOKEN_SYMBOL} raised`}
                  />
                ))}
              {current === "delivering" && delivering.map(l => <Row key={l.id} item={l} note={deliveringNote(l)} />)}
              {current === "reviewing" &&
                committee.map(m => {
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
                          <Link href={`/initiative/${m.l.id}`} className="btn btn-sm btn-primary">
                            Open
                          </Link>
                        ) : undefined
                      }
                    />
                  );
                })}
            </ul>
          )}
        </section>
      )}

      <section className="surface space-y-3 p-5 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Your recent activity</h2>
          <p className="text-sm opacity-60">The latest things that involve your wallet, newest first.</p>
        </div>
        <FeedList items={feed} empty="Nothing involving this wallet has happened on this network yet." />
      </section>
    </div>
  );
};

export default Activity;
