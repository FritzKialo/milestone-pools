import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { type Chain, type Transport, fallback, http } from "viem";
import { mainnet } from "viem/chains";
import scaffoldConfig, { DEFAULT_ALCHEMY_API_KEY, ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);

function transportFor(chain: Chain): Transport {
  const mainnetFallbackWithDefaultRPC = [http("https://mainnet.rpc.buidlguidl.com")];
  let rpcFallbacks = [...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []), http()];
  const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id];
  if (rpcOverrideUrl) {
    rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
  } else {
    const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
    if (alchemyHttpUrl) {
      const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
      rpcFallbacks = isUsingDefaultKey
        ? [...rpcFallbacks, http(alchemyHttpUrl)]
        : [http(alchemyHttpUrl), ...rpcFallbacks];
    }
  }
  return fallback(rpcFallbacks);
}

export const appKitNetworks = enabledChains as unknown as [AppKitNetwork, ...AppKitNetwork[]];

export const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId: scaffoldConfig.walletConnectProjectId,
  ssr: true,
  transports: Object.fromEntries(enabledChains.map(chain => [chain.id, transportFor(chain)])),
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
