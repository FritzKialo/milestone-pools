"use client";

import { useState } from "react";
import Link from "next/link";
import { erc20Abi, parseAbi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useChainWrite } from "~~/hooks/useChainWrite";
import { MULTI_CHAIN, poolChain } from "~~/lib/chains";
import { type Initiative, TOKEN_SYMBOL, fmtAmount, parseAmount } from "~~/lib/pools";

const mintAbi = parseAbi(["function mint(address to, uint256 amount)"]);

export const ContributeBox = ({ item }: { item: Initiative }) => {
  const { address, chain: walletChain } = useAccount();
  const net = poolChain(item.chainId);
  const pools = net?.pools;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: balance } = useReadContract({
    chainId: item.chainId,
    address: item.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  const { data: allowance } = useReadContract({
    chainId: item.chainId,
    address: item.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && pools ? [address, pools.address] : undefined,
    query: { enabled: !!address && !!pools, refetchInterval: 5000 },
  });
  const { data: mine } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "contributions",
    chainId: item.chainId,
    args: [BigInt(item.id), address],
    watch: true,
  });

  const send = useChainWrite();
  const { writeContractAsync: poolWrite } = useScaffoldWriteContract({
    contractName: "MilestonePools",
    chainId: item.chainId,
  });

  const remaining = item.goal - item.raised;
  const amount = parseAmount(text);
  const needsApproval = amount !== null && (allowance ?? 0n) < amount;

  let problem = "";
  if (text && amount === null) problem = "Enter a number with up to 6 decimals.";
  else if (amount !== null && amount === 0n) problem = "Enter an amount above zero.";
  else if (amount !== null && amount > remaining)
    problem = `Only ${fmtAmount(remaining)} ${TOKEN_SYMBOL} is still needed.`;
  else if (amount !== null && balance !== undefined && amount > balance) problem = "That is more than your balance.";

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (!address) {
    return <p className="text-sm opacity-70">Connect a wallet to contribute.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="opacity-70">Your balance</span>
        <span>
          {fmtAmount(balance ?? 0n)} {TOKEN_SYMBOL}
        </span>
      </div>
      {mine !== undefined && mine > 0n && (
        <div className="flex justify-between text-sm">
          <span className="opacity-70">You have contributed</span>
          <span>
            {fmtAmount(mine)} {TOKEN_SYMBOL}
          </span>
        </div>
      )}
      <div className="join w-full">
        <input
          className="input input-bordered join-item w-full"
          inputMode="decimal"
          placeholder={`Amount in ${TOKEN_SYMBOL}`}
          value={text}
          onChange={e => setText(e.target.value)}
          aria-label="Contribution amount"
        />
        <button className="btn join-item" onClick={() => setText(formatMax(remaining, balance))} type="button">
          Max
        </button>
      </div>
      {problem && <p className="text-sm text-error">{problem}</p>}

      {needsApproval && !problem ? (
        <button
          className="btn btn-neutral w-full"
          disabled={busy || !pools}
          onClick={() =>
            run(() =>
              send(item.chainId, {
                address: item.token,
                abi: erc20Abi,
                functionName: "approve",
                args: [pools!.address, amount ?? 0n],
              }),
            )
          }
        >
          {busy ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            `1. Allow the pool to take ${text} ${TOKEN_SYMBOL}`
          )}
        </button>
      ) : (
        <button
          className="btn btn-primary w-full"
          disabled={busy || amount === null || amount === 0n || !!problem}
          onClick={() =>
            run(async () => {
              await poolWrite({ functionName: "contribute", args: [BigInt(item.id), amount ?? 0n] });
              setText("");
            })
          }
        >
          {busy ? (
            <span className="loading loading-spinner loading-sm" />
          ) : amount ? (
            `Contribute ${text} ${TOKEN_SYMBOL}`
          ) : (
            "Contribute"
          )}
        </button>
      )}
      {MULTI_CHAIN && net && walletChain?.id !== item.chainId && (
        <p className="text-xs opacity-60">Your wallet will switch to {net.label} when you confirm.</p>
      )}
      <p className="text-xs opacity-60">
        Contributions are held by the contract. If the initiative fails or is cancelled, the part that has not been paid
        out is refundable to you. Read{" "}
        <Link className="link" href="/terms">
          Terms &amp; Risks
        </Link>{" "}
        first.
      </p>
      {net?.testnet && (
        <button
          type="button"
          className="link text-xs opacity-70"
          disabled={busy}
          onClick={() =>
            run(() =>
              send(item.chainId, {
                address: item.token,
                abi: mintAbi as any,
                functionName: "mint",
                args: [address, 1_000_000_000n],
              }),
            )
          }
        >
          Get 1,000 test {TOKEN_SYMBOL}
        </button>
      )}
    </div>
  );
};

function formatMax(remaining: bigint, balance: bigint | undefined) {
  const cap = balance !== undefined && balance < remaining ? balance : remaining;
  const whole = cap / 1_000_000n;
  const frac = (cap % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
