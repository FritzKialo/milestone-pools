"use client";

import { MULTI_CHAIN, poolChain } from "~~/lib/chains";

/** Small network label with a colour dot. Hidden when the site runs on a single network, where it would say nothing. */
export const ChainBadge = ({
  chainId,
  always = false,
  className = "",
}: {
  chainId: number;
  always?: boolean;
  className?: string;
}) => {
  const c = poolChain(chainId);
  if (!c || (!MULTI_CHAIN && !always)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs opacity-80 ${className}`}
      title={`On ${c.chain.name}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
      {c.label}
    </span>
  );
};
