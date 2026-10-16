import { createAppKit } from "@reown/appkit/react";
import scaffoldConfig from "~~/scaffold.config";
import { appKitNetworks, wagmiAdapter } from "~~/services/web3/wagmiConfig";

const siteUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL || "https://pools.frenkia.com";

/** Wallet window: email login, browser wallets and the QR code for mobile wallets. */
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: appKitNetworks,
  defaultNetwork: appKitNetworks[0],
  projectId: scaffoldConfig.walletConnectProjectId,
  metadata: {
    name: "Milestone Pools",
    description: "Pooled, milestone-gated funding with a fixed review committee.",
    url: siteUrl,
    icons: [`${siteUrl}/icon.svg`],
  },
  features: {
    email: true,
    socials: false,
    swaps: false,
    onramp: false,
    history: false,
    analytics: false,
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#f0b64a",
    "--w3m-border-radius-master": "2px",
  },
});
