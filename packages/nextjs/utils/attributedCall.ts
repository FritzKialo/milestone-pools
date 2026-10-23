import { type Abi, type Address, type Hex, encodeFunctionData } from "viem";
import type { Config } from "wagmi";
import { getCapabilities, sendCalls, waitForCallsStatus } from "wagmi/actions";

/**
 * Wallets such as Base Account can add the Builder Code to a transaction themselves (the ERC-8021 `dataSuffix`
 * capability of `wallet_sendCalls`). Smart-account wallets need this, because they wrap the app's call in their own
 * transaction, and a suffix appended to the call alone is then not at the end of what reaches the chain.
 */

/** True when the connected wallet says it will append a data suffix on this network. Any error counts as no. */
export async function walletAppendsDataSuffix(config: Config, account: Address, chainId: number): Promise<boolean> {
  try {
    const capabilities = (await getCapabilities(config, { account, chainId })) as Record<string, unknown> | undefined;
    const dataSuffix = capabilities?.dataSuffix as { supported?: boolean } | undefined;
    return dataSuffix?.supported === true;
  } catch {
    return false;
  }
}

type AttributedCall = {
  chainId: number;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  /** The ERC-8021 suffix from builderCodeSuffixFor. */
  suffix: Hex;
};

/**
 * Sends one contract call through `wallet_sendCalls` with the Builder Code as the `dataSuffix` capability, waits
 * until it is included, and returns the transaction hash, so it can be passed to the transactor like any write.
 */
export async function sendAttributedCall(config: Config, call: AttributedCall): Promise<Hex> {
  const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args ?? [] });
  const { id } = await sendCalls(config, {
    chainId: call.chainId,
    calls: [{ to: call.address, data, value: call.value }],
    capabilities: { dataSuffix: { value: call.suffix, optional: true } },
  });
  const result = await waitForCallsStatus(config, { id, timeout: 180_000 });
  const hash = result.receipts?.[result.receipts.length - 1]?.transactionHash;
  if (result.status !== "success" || !hash) throw new Error("The wallet could not complete the transaction.");
  return hash;
}
