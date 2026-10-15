/** Chains where the deployed contracts have been verified on the block explorer. */
export const VERIFIED_CHAIN_IDS: number[] = [11155111];

/** Public source repository. Set NEXT_PUBLIC_REPO_URL when the repository is public; the link is hidden otherwise. */
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL?.startsWith("https://")
  ? process.env.NEXT_PUBLIC_REPO_URL
  : "";

/** Where people send questions, bug reports and security reports. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "frenkiac@frenkia.com";
