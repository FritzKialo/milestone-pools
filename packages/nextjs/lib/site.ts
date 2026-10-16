import scaffoldConfig from "~~/scaffold.config";

/** True while the app points at a test network (or a local chain). Test-only text and buttons key off this. */
export const IS_TESTNET = scaffoldConfig.targetNetworks.every(
  n => (n as { testnet?: boolean }).testnet === true || n.id === 31337,
);

/** Name of the network the site is set to. */
export const NETWORK_NAME: string = scaffoldConfig.targetNetworks[0].name;

/** Chains where the deployed contracts have been verified on the block explorer. */
export const VERIFIED_CHAIN_IDS: number[] = [11155111];

/** Public source repository. Set NEXT_PUBLIC_REPO_URL when the repository is public; the link is hidden otherwise. */
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL?.startsWith("https://")
  ? process.env.NEXT_PUBLIC_REPO_URL
  : "";

/** Where people send questions, bug reports and security reports. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "frenkiac@frenkia.com";
