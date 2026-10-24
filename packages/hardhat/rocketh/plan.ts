/**
 * What to deploy on each network, chosen by chain ID.
 *
 * Test networks and local chains get a free test USDC and generous limits.
 * Real networks use Circle's USDC and small beta limits, which are fixed for the life of the contract:
 * raising them means deploying a new contract. Override with environment variables when deploying:
 *   POOLS_MIN_CONTRIBUTION (default 1), POOLS_MAX_GOAL (default 500), POOLS_TOTAL_CAP (default 5000), all in USDC.
 *
 * Any chain that is in neither list is refused, so a real network can never get a test token by mistake.
 */

/** Circle's native USDC by chain ID, from developers.circle.com/stablecoins/usdc-contract-addresses. */
export const REAL_USDC: Record<number, `0x${string}`> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum One
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // OP Mainnet
};

/** Local chains and test networks, where a free test USDC is deployed. */
export const TEST_CHAINS: Record<number, string> = {
  31337: "Hardhat (local)",
  11155111: "Sepolia",
  84532: "Base Sepolia",
  421614: "Arbitrum Sepolia",
  11155420: "OP Sepolia",
};

export type Plan = {
  /** True when a test token should be deployed. Otherwise `token` is the real USDC. */
  mock: boolean;
  token?: `0x${string}`;
  minimum: bigint;
  maxGoal: bigint;
  totalCap: bigint;
};

const usdc = (value: string | undefined, fallback: number): bigint => {
  const n = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Not a valid USDC amount: ${value}`);
  return BigInt(Math.round(n * 1_000_000));
};

export function planFor(chainId: number, env: Record<string, string | undefined> = process.env): Plan {
  const token = REAL_USDC[chainId];
  if (!token) {
    if (!(chainId in TEST_CHAINS)) {
      throw new Error(
        `Chain ${chainId} is not a known test network and has no USDC address configured. ` +
          "Add it to REAL_USDC or TEST_CHAINS in rocketh/plan.ts before deploying.",
      );
    }
    // Local and test networks: free test token and generous demo limits.
    return { mock: true, minimum: 1_000_000n, maxGoal: 1_000_000_000_000n, totalCap: 10_000_000_000_000n };
  }
  const minimum = usdc(env.POOLS_MIN_CONTRIBUTION, 1);
  const maxGoal = usdc(env.POOLS_MAX_GOAL, 500);
  const totalCap = usdc(env.POOLS_TOTAL_CAP, 5000);
  if (maxGoal < minimum || totalCap < maxGoal) {
    throw new Error("Limits must satisfy: minimum <= goal limit <= total cap");
  }
  return { mock: false, token, minimum, maxGoal, totalCap };
}
