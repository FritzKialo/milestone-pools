"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { type Initiative, TOKEN_SYMBOL, fmtAmount, parseAmount } from "~~/lib/pools";
import { IS_TESTNET } from "~~/lib/site";

export const ContributeBox = ({ item }: { item: Initiative }) => {
  const { address } = useAccount();
  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: balance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address],
    watch: true,
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [address, pools?.address],
    watch: true,
  });
  const { data: mine } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "contributions",
    args: [BigInt(item.id), address],
    watch: true,
  });

  const { writeContractAsync: token } = useScaffoldWriteContract({ contractName: "MockUSDC" });
  const { writeContractAsync: poolWrite } = useScaffoldWriteContract({ contractName: "MilestonePools" });

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
          onClick={() => run(() => token({ functionName: "approve", args: [pools?.address, amount ?? 0n] }))}
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
      <p className="text-xs opacity-60">
        Contributions are held by the contract. If the initiative fails or is cancelled, the part that has not been paid
        out is refundable to you. Read{" "}
        <Link className="link" href="/terms">
          Terms &amp; Risks
        </Link>{" "}
        first.
      </p>
      {IS_TESTNET && (
        <button
          type="button"
          className="link text-xs opacity-70"
          disabled={busy}
          onClick={() => run(() => token({ functionName: "mint", args: [address, 1_000_000_000n] }))}
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
