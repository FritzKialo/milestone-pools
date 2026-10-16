import type { Abi, Chain } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import scaffoldConfig from "~~/scaffold.config";

/**
 * The networks this site reads from and writes to. A network is live here when it is listed in
 * NEXT_PUBLIC_NETWORKS (see scaffold.config.ts) and the MilestonePools contract is deployed on it.
 * Adding a network is one entry in scaffold.config.ts plus one deployment.
 */

export type PoolChain = {
  id: number;
  /** Used in links, for example /initiative/base-12 */
  slug: string;
  /** Short name shown on cards */
  label: string;
  chain: Chain;
  testnet: boolean;
  explorerUrl: string | undefined;
  explorerName: string | undefined;
  /** Dot colour for the network label */
  color: string;
  pools: { address: `0x${string}`; abi: Abi; deployedOnBlock: number };
  /** The USDC the pools accept here: the free test token on test networks, Circle's USDC on real networks. */
  usdc: `0x${string}` | undefined;
};

/** Circle's native USDC on each network, as listed at developers.circle.com/stablecoins/usdc-contract-addresses. */
export const REAL_USDC: Record<number, `0x${string}`> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
};

const META: Record<number, { slug: string; label: string; color: string }> = {
  11155111: { slug: "sepolia", label: "Sepolia", color: "#7c5cff" },
  8453: { slug: "base", label: "Base", color: "#0052ff" },
  42161: { slug: "arbitrum", label: "Arbitrum", color: "#28a0f0" },
  10: { slug: "optimism", label: "Optimism", color: "#ff0420" },
  1: { slug: "ethereum", label: "Ethereum", color: "#627eea" },
  31337: { slug: "local", label: "Local", color: "#b8af0c" },
};

type Deployments = Record<number, Record<string, { address: `0x${string}`; abi: Abi; deployedOnBlock?: number }>>;

const deployments = deployedContracts as unknown as Deployments;

export const POOL_CHAINS: PoolChain[] = scaffoldConfig.targetNetworks.flatMap(chain => {
  const pools = deployments[chain.id]?.MilestonePools;
  if (!pools) return [];
  const meta = META[chain.id] ?? { slug: `chain-${chain.id}`, label: chain.name, color: "#888888" };
  const testnet = (chain as { testnet?: boolean }).testnet === true || chain.id === 31337;
  return [
    {
      id: chain.id,
      slug: meta.slug,
      label: meta.label,
      color: meta.color,
      chain,
      testnet,
      explorerUrl: chain.blockExplorers?.default.url,
      explorerName: chain.blockExplorers?.default.name,
      pools: { address: pools.address, abi: pools.abi, deployedOnBlock: pools.deployedOnBlock ?? 0 },
      usdc: testnet ? deployments[chain.id]?.MockUSDC?.address : REAL_USDC[chain.id],
    },
  ];
});

export const MULTI_CHAIN = POOL_CHAINS.length > 1;

/** The chain used when a link does not name one, and for pages that need a single contract. */
export const DEFAULT_POOL_CHAIN: PoolChain | undefined = POOL_CHAINS[0];

export const poolChain = (id: number | undefined): PoolChain | undefined => POOL_CHAINS.find(c => c.id === id);

export const poolChainBySlug = (slug: string): PoolChain | undefined => POOL_CHAINS.find(c => c.slug === slug);

/** Test tokens and the demo notice apply only when every live network is a test network. */
export const ALL_TESTNET = POOL_CHAINS.length > 0 && POOL_CHAINS.every(c => c.testnet);

/* ----------------------------------------------------------------------------
 * Identity. An initiative is identified by its network and its number there.
 * ------------------------------------------------------------------------- */

/** Stable key used for lookups, saved lists and React keys, for example "8453:12". */
export const uidOf = (chainId: number, id: number | bigint) => `${chainId}:${id}`;

/** Link path for an initiative, for example "/initiative/base-12". */
export const initiativePath = (ref: { chainId: number; id: number }) => {
  const c = poolChain(ref.chainId);
  return `/initiative/${c ? c.slug : `chain-${ref.chainId}`}-${ref.id}`;
};

/**
 * Reads the part of the URL after /initiative/. "base-12" names a network. A plain "12" is an older link and
 * means the first network on the site.
 */
export function parseInitiativeRef(param: string): { chainId: number; id: number } | null {
  const m = /^(?:([a-z0-9-]+?)-)?(\d+)$/.exec(decodeURIComponent(param).toLowerCase());
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  if (!m[1]) return DEFAULT_POOL_CHAIN ? { chainId: DEFAULT_POOL_CHAIN.id, id } : null;
  const c = poolChainBySlug(m[1]);
  return c ? { chainId: c.id, id } : null;
}
