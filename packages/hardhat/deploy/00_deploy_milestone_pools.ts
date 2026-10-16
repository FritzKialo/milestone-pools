import { deployScript, artifacts } from "../rocketh/deploy.js";

/**
 * Deploys a test USDC (free to mint, 6 decimals) and MilestonePools with that token allowlisted.
 * The token is a stand-in for demos on local and test networks only.
 * A mainnet deployment would pass real token addresses to the constructor instead.
 */
export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    const usdc = await env.deploy("MockUSDC", {
      account: deployer,
      artifact: artifacts.MockERC20,
      args: ["USD Coin (test)", "USDC", 6],
    });

    const pools = await env.deploy("MilestonePools", {
      account: deployer,
      artifact: artifacts.MilestonePools,
      // allowlist: [token]; minimum contribution: 1 USDC; largest goal per initiative: 1,000,000 USDC;
      // most the contract may hold at once: 10,000,000 USDC. These are generous demo limits.
      // A real beta launch would use small values, for example a 500 USDC goal limit and a
      // 5,000 USDC total cap, because limits are fixed at deployment.
      args: [[usdc.address], [1_000_000n], [1_000_000_000_000n], [10_000_000_000_000n]],
    });

    console.log("Test USDC:      ", usdc.address);
    console.log("MilestonePools: ", pools.address);
  },
  { tags: ["MilestonePools"] },
);
