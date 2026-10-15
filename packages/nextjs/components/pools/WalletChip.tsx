"use client";

import Link from "next/link";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { shortAddr } from "~~/lib/pools";

/** A wallet shown as an avatar and a short address that opens its profile page. */
export const WalletChip = ({
  address,
  sub,
  size = 36,
  className = "",
}: {
  address: `0x${string}`;
  sub?: React.ReactNode;
  size?: number;
  className?: string;
}) => (
  <Link
    href={`/profile/${address}`}
    className={`flex min-w-0 items-center gap-3 rounded-lg hover:opacity-90 ${className}`}
    title={address}
  >
    <span className="shrink-0 overflow-hidden rounded-full ring-1 ring-base-300">
      <BlockieAvatar address={address} size={size} />
    </span>
    <span className="min-w-0">
      <span className="block truncate font-mono text-sm">{shortAddr(address)}</span>
      {sub && <span className="block truncate text-xs tabular opacity-60">{sub}</span>}
    </span>
  </Link>
);
