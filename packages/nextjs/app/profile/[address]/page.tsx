"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { ArrowUpRightIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { ChainBadge } from "~~/components/pools/ChainBadge";
import { StatusBadge } from "~~/components/pools/StatusBadge";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth";
import { POOL_CHAINS, initiativePath } from "~~/lib/chains";
import { type Listing, TOKEN_SYMBOL, fmtAmount, useListings, useMetadata, usePoolEvents } from "~~/lib/pools";
import { buildProfile, useContributions } from "~~/lib/stats";

const Row = ({ item, note }: { item: Listing; note: string }) => {
  const meta = useMetadata(item.metadataURI, item.id);
  return (
    <li className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-base-200/60">
      <div className="min-w-0">
        <Link
          href={initiativePath(item)}
          className="block truncate font-medium after:absolute after:inset-0 after:content-['']"
        >
          {meta.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 text-sm tabular opacity-70">
          <span>{note}</span>
          <ChainBadge chainId={item.chainId} />
        </div>
      </div>
      <StatusBadge status={item.status} />
    </li>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold">{title}</h2>
    <ul className="surface divide-y divide-base-300 overflow-hidden">{children}</ul>
  </section>
);

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="surface p-4">
    <div className="text-xl font-semibold tabular sm:text-2xl">{value}</div>
    <div className="text-sm opacity-70">{label}</div>
  </div>
);

const ProfilePage: NextPage<{ params: Promise<{ address: string }> }> = ({ params }) => {
  const { address: raw } = use(params);
  const valid = isAddress(raw);
  const address = (valid ? raw : "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const { address: me } = useAccount();
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  const { listings, isLoading } = useListings();
  const { data: contributions } = useContributions();
  const { data: events } = usePoolEvents();

  const profile = useMemo(
    () => buildProfile(address, listings, contributions, events),
    [address, listings, contributions, events],
  );
  const byId = useMemo(() => new Map(listings.map(l => [l.uid, l])), [listings]);

  if (!valid) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">That is not a wallet address</h1>
        <Link href="/explore" className="btn btn-primary">
          Back to Explore
        </Link>
      </div>
    );
  }

  const isMe = me?.toLowerCase() === address.toLowerCase();
  const empty =
    profile.backed.length + profile.created.length + profile.reviewing.length + profile.receiving.length === 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10">
      <header className="glass flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="shrink-0 self-start overflow-hidden rounded-full ring-2 ring-base-300">
          <BlockieAvatar address={address} size={72} />
        </span>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Wallet profile</h1>
            {isMe && <span className="badge badge-soft badge-success">This is you</span>}
          </div>
          <p className="break-all font-mono text-sm opacity-80">{address}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm border-base-300 bg-base-100"
              onClick={() => copyToClipboard(address)}
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              {isCopiedToClipboard ? "Copied" : "Copy address"}
            </button>
            {POOL_CHAINS.filter(c => c.explorerUrl).map(c => (
              <a
                key={c.id}
                className="btn btn-sm border-base-300 bg-base-100"
                href={`${c.explorerUrl}/address/${address}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {POOL_CHAINS.length > 1 ? `${c.label} explorer` : "Block explorer"}
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </a>
            ))}
            {isMe && (
              <Link href="/activity" className="btn btn-sm btn-primary">
                My activity
              </Link>
            )}
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat value={`${fmtAmount(profile.totalBacked, 0)} ${TOKEN_SYMBOL}`} label="Contributed" />
            <Stat value={profile.backed.length.toString()} label="Initiatives backed" />
            <Stat value={profile.created.length.toString()} label="Initiatives created" />
            <Stat value={profile.reviewing.length.toString()} label="Committees joined" />
            <Stat value={profile.votesCast.toString()} label="Votes cast" />
            <Stat value={`${fmtAmount(profile.totalReceived, 0)} ${TOKEN_SYMBOL}`} label="Approved for this wallet" />
          </div>

          {empty && (
            <div className="surface border-dashed p-10 text-center">
              <p className="font-medium">Nothing here yet.</p>
              <p className="mx-auto mt-1 max-w-md text-sm opacity-70">
                This wallet has not backed, created, reviewed or received anything on this platform.
              </p>
            </div>
          )}

          {profile.backed.length > 0 && (
            <Section title="Backed">
              {profile.backed.map(b => {
                const item = byId.get(b.uid);
                return item ? (
                  <Row
                    key={b.uid}
                    item={item}
                    note={`${fmtAmount(b.total)} ${TOKEN_SYMBOL} in ${b.count} ${b.count === 1 ? "contribution" : "contributions"}`}
                  />
                ) : null;
              })}
            </Section>
          )}

          {profile.reviewing.length > 0 && (
            <Section title="On the review committee">
              {profile.reviewing.map(r => {
                const item = byId.get(r.uid);
                return item ? (
                  <Row key={r.uid} item={item} note={`${r.votes} ${r.votes === 1 ? "vote" : "votes"} cast`} />
                ) : null;
              })}
            </Section>
          )}

          {profile.created.length > 0 && (
            <Section title="Created">
              {profile.created.map(item => (
                <Row
                  key={item.uid}
                  item={item}
                  note={`${fmtAmount(item.raised)} of ${fmtAmount(item.goal)} ${TOKEN_SYMBOL}`}
                />
              ))}
            </Section>
          )}

          {profile.receiving.length > 0 && (
            <Section title="Doing the work">
              {profile.receiving.map(r => {
                const item = byId.get(r.uid);
                return item ? (
                  <Row key={r.uid} item={item} note={`${fmtAmount(r.paid)} ${TOKEN_SYMBOL} approved so far`} />
                ) : null;
              })}
            </Section>
          )}
        </>
      )}
    </div>
  );
};

export default ProfilePage;
