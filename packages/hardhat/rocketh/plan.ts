/**
 * What to deploy on each network.
 *
 * Test networks and local chains get a free test USDC and generous limits.
 * Real networks use Circle's USDC and small beta limits, which are fixed for the life of the contract:
 * raising them means deploying a new contract. Override with environment variables when deploying:
 *   POOLS_MIN_CONTRIBUTION (default 1), POOLS_MAX_GOAL (default 500), POOLS_TOTAL_CAP (default 5000), all in USDC.
 */

/** Circle's native USDC, from developers.circle.com/stablecoins/usdc-contract-addresses. */
export const REAL_USDC: Record<string, `0x${string}`> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
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

export function planFor(networkName: string, env: Record<string, string | undefined> = process.env): Plan {
  const token = REAL_USDC[networkName];
  if (!token) {
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
