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
import { ChainBadge } from "~~/components/pools/ChainBadge";
import { CategoryIcon } from "~~/components/pools/Cover";
import { FeedList } from "~~/components/pools/FeedList";
import { FundingBar } from "~~/components/pools/FundingBar";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import { BlockieAvatar, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth";
import { useChainWrite } from "~~/hooks/useChainWrite";
import { MULTI_CHAIN, POOL_CHAINS, initiativePath, poolChain } from "~~/lib/chains";
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
            href={initiativePath(item)}
            className="font-medium after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {meta.title}
          </Link>
          <StatusBadge status={item.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 text-sm tabular opacity-70">
          <span>
            {CATEGORIES[item.category] ?? "Other"}. {note}
          </span>
          <ChainBadge chainId={item.chainId} />
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
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  const { listings, isLoading } = useListings();
  const title = useTitleMap();
  const { items: feed } = useFeed(10, undefined, address);
  const send = useChainWrite();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

  // Approved payments waiting to be withdrawn, one balance per network.
  const { data: creditReads } = useReadContracts({
    contracts: (address
      ? POOL_CHAINS.filter(c => c.usdc).map(c => ({
          chainId: c.id,
          address: c.pools.address,
          abi: c.pools.abi,
          functionName: "credits",
          args: [c.usdc, address],
        }))
      : []) as any,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const enabled = !!address && listings.length > 0;
  const { data: backed } = useReadContracts({
    contracts: (enabled
      ? listings.flatMap(l => {
          const pools = poolChain(l.chainId)!.pools;
          return [
            {
              chainId: l.chainId,
              address: pools.address,
              abi: pools.abi,
              functionName: "contributions",
              args: [BigInt(l.id), address],
            },
            {
              chainId: l.chainId,
              address: pools.address,
              abi: pools.abi,
              functionName: "refundableOf",
              args: [BigInt(l.id), address],
            },
            {
              chainId: l.chainId,
              address: pools.address,
              abi: pools.abi,
              functionName: "hasVoted",
              args: [BigInt(l.id), l.reviewNo, address],
            },
          ];
        })
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
  const credits = POOL_CHAINS.filter(c => c.usdc).map((c, k) => {
    const r = creditReads?.[k];
    return { chain: c, amount: r?.status === "success" ? (r.result as bigint) : 0n };
  });
  const withdrawable = credits.reduce((s, c) => s + c.amount, 0n);

  const withdraw = (c: (typeof credits)[number]["chain"]) =>
    run(`withdraw${c.id}`, () =>
      send(c.id, { address: c.pools.address, abi: c.pools.abi, functionName: "withdraw", args: [c.usdc] }),
    );

  const claimRefund = (l: Listing) =>
    run(`refund${l.uid}`, () =>
      send(l.chainId, {
        address: poolChain(l.chainId)!.pools.address,
        abi: poolChain(l.chainId)!.pools.abi,
        functionName: "refund",
        args: [BigInt(l.id)],
      }),
    );

  const todos: Todo[] = [
    ...backedList
      .filter(m => m.refundable > 0n)
      .map(m => ({
        key: `refund${m.l.uid}`,
        text: `Claim your ${fmtAmount(m.refundable)} ${TOKEN_SYMBOL} refund from ${title(m.l.uid)}`,
        action: (
          <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => claimRefund(m.l)}>
            {busy === `refund${m.l.uid}` ? <span className="loading loading-spinner loading-xs" /> : "Claim refund"}
          </button>
        ),
      })),
    ...committee
      .filter(m => m.l.status === "Active" && m.l.phase === "UnderReview" && !m.voted)
      .map(m => ({
        key: `vote${m.l.uid}`,
        text: `Vote on milestone ${m.l.currentMilestone + 1} of ${title(m.l.uid)}`,
        action: (
          <Link href={initiativePath(m.l)} className="btn btn-sm btn-primary">
            Open
          </Link>
        ),
      })),
    ...committee
      .filter(m => m.l.status === "Selecting")
      .map(m => ({
        key: `select${m.l.uid}`,
        text: `Choose a grantee for ${title(m.l.uid)}`,
        action: (
          <Link href={initiativePath(m.l)} className="btn btn-sm btn-primary">
            Open
          </Link>
        ),
      })),
    ...delivering
      .filter(l => l.status === "Active" && l.phase === "AwaitingSubmission")
      .map(l => ({
        key: `evidence${l.uid}`,
        text: `Submit evidence for milestone ${l.currentMilestone + 1} of ${title(l.uid)}`,
        action: (
          <Link href={initiativePath(l)} className="btn btn-sm btn-primary">
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
      [
        "network",
        "initiative",
        "title",
        "my role",
        "status",
        `contributed (${TOKEN_SYMBOL})`,
        `refundable (${TOKEN_SYMBOL})`,
      ],
      ...backedList.map(m => [
        poolChain(m.l.chainId)?.label ?? m.l.chainId,
        m.l.id,
        title(m.l.uid),
        "backer",
        m.l.status,
        Number(m.contributed) / 10 ** TOKEN_DECIMALS,
        Number(m.refundable) / 10 ** TOKEN_DECIMALS,
      ]),
      ...created.map(l => [poolChain(l.chainId)?.label ?? l.chainId, l.id, title(l.uid), "creator", l.status, "", ""]),
      ...delivering.map(l => [
        poolChain(l.chainId)?.label ?? l.chainId,
        l.id,
        title(l.uid),
        "grantee",
        l.status,
        "",
        "",
      ]),
      ...committee.map(m => [
        poolChain(m.l.chainId)?.label ?? m.l.chainId,
        m.l.id,
        title(m.l.uid),
        "reviewer",
        m.l.status,
        "",
        "",
      ]),
    ]);

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
              {POOL_CHAINS.map(c => (
                <ChainBadge key={c.id} chainId={c.id} always />
              ))}
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
          {POOL_CHAINS.filter(c => c.explorerUrl).map(c => (
            <a
              key={c.id}
              className="btn btn-sm border-base-300 bg-base-100"
              href={`${c.explorerUrl}/address/${address}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {MULTI_CHAIN ? `${c.label} explorer` : "Explorer"}
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
            </a>
          ))}
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
        <div className="flex flex-col gap-2">
          {credits.map(c => (
            <button
              key={c.chain.id}
              className="btn btn-primary btn-glow btn-lg"
              disabled={c.amount === 0n || !!busy}
              onClick={() => withdraw(c.chain)}
            >
              {busy === `withdraw${c.chain.id}` ? (
                <span className="loading loading-spinner loading-sm" />
              ) : MULTI_CHAIN ? (
                `Withdraw ${fmtAmount(c.amount)} on ${c.chain.label}`
              ) : (
                "Withdraw"
              )}
            </button>
          ))}
        </div>
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
                    key={m.l.uid}
                    item={m.l}
                    note={`You contributed ${fmtAmount(m.contributed)} ${TOKEN_SYMBOL}${
                      m.refundable > 0n ? `. Refund available: ${fmtAmount(m.refundable)} ${TOKEN_SYMBOL}` : ""
                    }`}
                    action={
                      m.refundable > 0n ? (
                        <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => claimRefund(m.l)}>
                          {busy === `refund${m.l.uid}` ? (
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
                    key={l.uid}
                    item={l}
                    note={`${fmtAmount(l.raised)} of ${fmtAmount(l.goal)} ${TOKEN_SYMBOL} raised`}
                  />
                ))}
              {current === "delivering" && delivering.map(l => <Row key={l.uid} item={l} note={deliveringNote(l)} />)}
              {current === "reviewing" &&
                committee.map(m => {
                  const needsVote = m.l.status === "Active" && m.l.phase === "UnderReview" && !m.voted;
                  const selecting = m.l.status === "Selecting";
                  return (
                    <Row
                      key={m.l.uid}
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
                          <Link href={initiativePath(m.l)} className="btn btn-sm btn-primary">
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
        <FeedList items={feed} empty="Nothing involving this wallet has happened yet." />
      </section>
    </div>
  );
};

export default Activity;
