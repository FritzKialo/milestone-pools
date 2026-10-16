import { ALL_TESTNET, POOL_CHAINS } from "~~/lib/chains";

/** True while every network on the site is a test network (or a local chain). Test-only text and buttons key off this. */
export const IS_TESTNET = ALL_TESTNET;

/** Plain-language name of the network(s) the site runs on, for example "Base, Arbitrum and Optimism". */
export const NETWORK_NAME: string = (() => {
  const names = POOL_CHAINS.map(c => c.label);
  if (names.length === 0) return "a supported network";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
})();

/** Chains where the deployed contracts have been verified on the block explorer. Add a chain id here once its contract is verified. */
export const VERIFIED_CHAIN_IDS: number[] = [11155111];

/** Public source repository. Set NEXT_PUBLIC_REPO_URL when the repository is public; the link is hidden otherwise. */
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL?.startsWith("https://")
  ? process.env.NEXT_PUBLIC_REPO_URL
  : "";

/** Where people send questions, bug reports and security reports. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "frenkiac@frenkia.com";
