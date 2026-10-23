import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "IZYEU2cWBgnFmgiTAgpWD";

/**
 * Networks the site can run on. To add a network: add it here, deploy the contract there
 * (`yarn deploy --network <name>`), and list its name in NEXT_PUBLIC_NETWORKS.
 */
const AVAILABLE: Record<string, chains.Chain> = {
  sepolia: chains.sepolia,
  base: chains.base,
  basesepolia: chains.baseSepolia,
  arbitrum: chains.arbitrum,
  optimism: chains.optimism,
  hardhat: chains.hardhat,
};

/**
 * Which networks are live on this site, as a comma separated list, for example "base,arbitrum,optimism".
 * Names are matched in lowercase, so Base Sepolia is "basesepolia".
 * Do not mix test networks and real networks in one list: the demo text and test-token buttons assume all or none.
 * The default is the Sepolia demo.
 */
const requested = (process.env.NEXT_PUBLIC_NETWORKS || "sepolia")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const picked = requested.map(name => AVAILABLE[name]).filter((c): c is chains.Chain => !!c);

const scaffoldConfig = {
  // The networks on which your DApp is live
  // Typed with Sepolia first so contract names are inferred from the Sepolia deployment, whatever list is chosen above.
  targetNetworks: (picked.length > 0 ? picked : [chains.sepolia]) as unknown as readonly [
    typeof chains.sepolia,
    ...chains.Chain[],
  ],
  // The interval at which your front-end polls the RPC servers for new data
  pollingInterval: 4000,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  // Use your own RPC for a network (recommended for a real launch): set NEXT_PUBLIC_RPC_<chain id>, for example
  // NEXT_PUBLIC_RPC_8453 for Base. The key is the chain ID, and the value is the HTTP RPC URL.
  rpcOverrides: Object.fromEntries(
    Object.entries({
      [chains.sepolia.id]: process.env.NEXT_PUBLIC_RPC_11155111,
      [chains.base.id]: process.env.NEXT_PUBLIC_RPC_8453,
      [chains.baseSepolia.id]: process.env.NEXT_PUBLIC_RPC_84532,
      [chains.arbitrum.id]: process.env.NEXT_PUBLIC_RPC_42161,
      [chains.optimism.id]: process.env.NEXT_PUBLIC_RPC_10,
    }).filter(([, url]) => !!url),
  ) as Record<number, string>,
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  // Configure Burner Wallet visibility:
  // - "localNetworksOnly": only show when all target networks are local (hardhat/anvil)
  // - "allNetworks": show on any configured target networks
  // - "disabled": completely disable
  burnerWalletMode: "localNetworksOnly",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;