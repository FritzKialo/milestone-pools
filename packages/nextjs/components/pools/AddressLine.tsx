"use client";

import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useCopyToClipboard, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { shortAddr } from "~~/lib/pools";

/** A wallet as a small avatar, a short address that opens the block explorer, and a labelled copy button. */
export const AddressLine = ({ address }: { address: `0x${string}` }) => {
  const { targetNetwork } = useTargetNetwork();
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  const explorer = targetNetwork.blockExplorers?.default.url;

  const label = <span className="font-mono">{shortAddr(address)}</span>;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="shrink-0 overflow-hidden rounded-full ring-1 ring-base-300">
        <BlockieAvatar address={address} size={22} />
      </span>
      {explorer ? (
        <a
          href={`${explorer}/address/${address}`}
          target="_blank"
          rel="noreferrer noopener"
          title={address}
          className="hover:text-primary"
        >
          {label}
        </a>
      ) : (
        <span title={address}>{label}</span>
      )}
      <button
        type="button"
        className="rounded p-0.5 opacity-60 hover:opacity-100"
        onClick={() => copyToClipboard(address)}
        aria-label={isCopiedToClipboard ? "Address copied" : `Copy address ${address}`}
      >
        {isCopiedToClipboard ? (
          <CheckIcon className="h-4 w-4 text-success" />
        ) : (
          <ClipboardDocumentIcon className="h-4 w-4" />
        )}
      </button>
    </span>
  );
};
