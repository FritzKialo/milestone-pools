import "dotenv/config";
import { defineConfig, overrideTask } from "hardhat/config";
import hardhatToolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import HardhatDeploy from "hardhat-deploy";
import generateTsAbis from "./scripts/generateTsAbis.js";

// Set by `yarn deploy` after it decrypts your deployer key. There is deliberately no fallback key:
// without it, real networks have no signer and any deploy fails instead of using a publicly known key.
// Local networks (default, hardhat) use the node's own accounts and do not need it.
// Generate a key with `yarn generate`, or import one with `yarn account:import`.
const deployerPrivateKey = process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY;
const deployerAccounts: string[] = deployerPrivateKey ? [deployerPrivateKey] : [];

// If not set, it uses ours Alchemy's default API key.
// You can get your own at https://dashboard.alchemyapi.io
const providerApiKey = process.env.ALCHEMY_API_KEY || "IZYEU2cWBgnFmgiTAgpWD";

export const etherscanApiKey = process.env.ETHERSCAN_API_KEY ?? "";

const deployTasks = [
  overrideTask("deploy")
    .setInlineAction(async (args, _hre, runSuper) => {
      // Run the original deploy task
      await runSuper(args);
      // Force run the generateTsAbis script
      await generateTsAbis();
    })
    .build(),
];

export default defineConfig({
  plugins: [hardhatToolbox, HardhatDeploy],
  solidity: {
    compilers: [
      {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
    ],
  },
  generateTypedArtifacts: {
    destinations: [
      {
        folder: "./generated",
        mode: "typescript",
      },
    ],
  },
  // Configuration for hardhat-verify and rocketh-verify
  verify: {
    etherscan: {
      apiKey: etherscanApiKey,
    },
  },
  networks: {
    // View the networks that are pre-configured.
    // If the network you are looking for is not here you can add new network settings
    default: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      type: "edr-simulated",
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`,
        enabled: process.env.MAINNET_FORKING_ENABLED === "true",
      },
    },
    mainnet: {
      type: "http",
      url: "https://mainnet.rpc.buidlguidl.com",
      accounts: deployerAccounts,
    },
    sepolia: {
      type: "http",
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: deployerAccounts,
    },
    optimism: {
      type: "http",
      url: `https://opt-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    optimismSepolia: {
      type: "http",
      url: `https://opt-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    base: {
      type: "http",
      url: process.env.BASE_RPC_URL || `https://base-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    baseSepolia: {
      type: "http",
      url: process.env.BASE_SEPOLIA_RPC_URL || `https://base-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    arbitrum: {
      type: "http",
      url: `https://arb-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    arbitrumSepolia: {
      type: "http",
      url: `https://arb-sepolia.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    scrollSepolia: {
      type: "http",
      url: "https://sepolia-rpc.scroll.io",
      accounts: deployerAccounts,
    },
    scroll: {
      type: "http",
      url: "https://rpc.scroll.io",
      accounts: deployerAccounts,
    },
    celo: {
      type: "http",
      url: "https://forno.celo.org",
      accounts: deployerAccounts,
    },
    celoSepolia: {
      type: "http",
      url: "https://forno.celo-sepolia.celo-testnet.org/",
      accounts: deployerAccounts,
    },
    polygon: {
      type: "http",
      url: `https://polygon-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    polygonAmoy: {
      type: "http",
      url: `https://polygon-amoy.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    gnosis: {
      type: "http",
      url: "https://rpc.gnosischain.com",
      accounts: deployerAccounts,
    },
    chiado: {
      type: "http",
      url: "https://rpc.chiadochain.net",
      accounts: deployerAccounts,
    },
    polygonZkEvm: {
      type: "http",
      url: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
    polygonZkEvmCardona: {
      type: "http",
      url: `https://polygonzkevm-cardona.g.alchemy.com/v2/${providerApiKey}`,
      accounts: deployerAccounts,
    },
  },
  tasks: deployTasks,
});
