"use client";

import { ArrowUpRightIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { shortAddr } from "~~/lib/pools";
import { VERIFIED_CHAIN_IDS } from "~~/lib/site";

/** A deployed contract's address, linked to the block explorer, with a note when its source is verified there. */
export const ContractLink = ({
  name,
  label,
  className = "",
}: {
  name: "MilestonePools" | "MockUSDC";
  label: string;
  className?: string;
}) => {
  const { targetNetwork } = useTargetNetwork();
  const { data } = useDeployedContractInfo({ contractName: name });
  if (!data) return null;

  const explorer = targetNetwork.blockExplorers?.default;
  const verified = !!explorer && VERIFIED_CHAIN_IDS.includes(targetNetwork.id);

  if (!explorer) {
    return (
      <span className={`inline-flex flex-wrap items-center gap-x-2 ${className}`}>
        <span className="opacity-60">{label}</span>
        <span className="font-mono" title={data.address}>
          {shortAddr(data.address)}
        </span>
        <span className="opacity-60">(local test chain)</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className="opacity-60">{label}</span>
      <a
        href={`${explorer.url}/address/${data.address}${verified ? "#code" : ""}`}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 font-mono hover:text-primary"
        title={data.address}
      >
        {shortAddr(data.address)}
        <ArrowUpRightIcon className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only">on {explorer.name}</span>
      </a>
      {verified && (
        <span className="badge badge-soft badge-success badge-sm gap-1">
          <CheckBadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Verified on {explorer.name}
        </span>
      )}
    </span>
  );
};
