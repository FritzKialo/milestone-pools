import React from "react";
import Link from "next/link";
import { hardhat } from "viem/chains";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Logo } from "~~/components/Header";
import { ChainBadge } from "~~/components/pools/ChainBadge";
import { ContractLink } from "~~/components/pools/ContractLink";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { POOL_CHAINS } from "~~/lib/chains";
import { REPO_URL } from "~~/lib/site";

const COLUMNS = [
  {
    title: "Use it",
    links: [
      { label: "Explore initiatives", href: "/explore" },
      { label: "Start an initiative", href: "/create" },
      { label: "My activity", href: "/activity" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "FAQ", href: "/faq" },
      { label: "Platform stats", href: "/stats" },
    ],
  },
  {
    title: "Read first",
    links: [
      { label: "Terms & Risks", href: "/terms" },
      { label: "Support", href: "/support" },
    ],
  },
];

/**
 * Site footer
 */
export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <footer className="mt-16 border-t border-base-300 bg-base-100">
      {isLocalNetwork && (
        <div className="pointer-events-none fixed bottom-0 left-0 z-10 flex w-full items-end justify-between p-4">
          <div className="pointer-events-auto flex flex-col gap-2 md:flex-row">
            <Faucet />
            <Link href="/blockexplorer" passHref className="btn btn-primary btn-sm gap-1 font-normal">
              <MagnifyingGlassIcon className="h-4 w-4" />
              <span>Block Explorer</span>
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)_1.6fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm opacity-70">
            Pooled funding that pays out milestone by milestone, approved by a review committee that is fixed from the
            start.
          </p>
        </div>
        {COLUMNS.map(c => (
          <div key={c.title}>
            <h2 className="mb-3 text-sm font-semibold">{c.title}</h2>
            <ul className="space-y-2 text-sm">
              {c.links.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="opacity-70 hover:opacity-100">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="mb-3 text-sm font-semibold">On-chain</h2>
          <ul className="space-y-2 text-sm">
            {POOL_CHAINS.map(c => (
              <li key={c.id} className="space-y-1">
                <ChainBadge chainId={c.id} always className="font-semibold opacity-100" />
                <div>
                  <ContractLink name="MilestonePools" label="Pools" chainId={c.id} />
                </div>
                <div>
                  <ContractLink name="USDC" label="USDC" chainId={c.id} />
                </div>
              </li>
            ))}
            {REPO_URL && (
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="opacity-70 hover:opacity-100">
                  Source code
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-base-300">
        <div className="mx-auto max-w-6xl px-4 py-5 text-sm opacity-70">
          Unaudited software. Contributions can be lost. Nothing on this site is legal, financial or tax advice.
        </div>
      </div>
    </footer>
  );
};
