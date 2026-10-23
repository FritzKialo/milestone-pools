import { Attribution } from "ox/erc8021";
import type { Hex } from "viem";

/**
 * Base Builder Code (ERC-8021 transaction attribution).
 *
 * Get the code from dashboard.base.org:
 * Settings -> Project Settings -> Builder Code (looks like "bc_xxxxxxxx").
 * Set it in the frontend environment as NEXT_PUBLIC_BASE_BUILDER_CODE.
 */
export const BUILDER_CODE: string = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE ?? "";

/** Base mainnet and Base Sepolia. Attribution only counts on Base. */
const BASE_CHAIN_IDS = new Set<number>([8453, 84532]);

/** The encoded ERC-8021 suffix, built once. Undefined when no code is set. */
const BUILDER_CODE_SUFFIX: Hex | undefined = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : undefined;

/**
 * Returns the suffix to append to a transaction on the given chain,
 * or undefined on non-Base chains so Arbitrum and Optimism calldata stays unchanged.
 *
 * Usage with wagmi (pass it on every write; do not rely on createConfig):
 *   writeContractAsync({ address, abi, functionName, args, dataSuffix: builderCodeSuffixFor(chainId) })
 */
export function builderCodeSuffixFor(chainId: number | undefined): Hex | undefined {
  if (!BUILDER_CODE_SUFFIX || chainId === undefined) return undefined;
  return BASE_CHAIN_IDS.has(chainId) ? BUILDER_CODE_SUFFIX : undefined;
}
