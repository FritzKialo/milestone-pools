"use client";

import type { Abi } from "viem";
import { useAccount, useConfig, useSwitchChain, useWriteContract } from "wagmi";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { poolChain } from "~~/lib/chains";
import { notification } from "~~/utils/scaffold-eth";
import { simulateContractWriteAndNotifyError } from "~~/utils/scaffold-eth/contract";

type Call = { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[] };

/**
 * Sends a transaction to any contract on any of the site's networks (for example the USDC token, whose address
 * comes from the initiative). It moves the wallet to that network first, simulates the call so a failure is explained
 * before anything is signed, and shows the usual progress toasts.
 */
export function useChainWrite() {
  const config = useConfig();
  const { chain, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const writeTx = useTransactor();

  return async (chainId: number, call: Call) => {
    if (!address) {
      notification.error("Please connect your wallet");
      return;
    }
    if (chain?.id !== chainId) {
      try {
        await switchChainAsync({ chainId });
      } catch {
        notification.error(`Switch your wallet to ${poolChain(chainId)?.label ?? "the right network"} to continue.`);
        return;
      }
    }
    const params = { ...call, chainId } as any;
    await simulateContractWriteAndNotifyError({ wagmiConfig: config, writeContractParams: params, chainId });
    return writeTx(() => writeContractAsync(params));
  };
}
