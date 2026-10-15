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
      // allowlist: [token], minimum contribution: 1 USDC
      args: [[usdc.address], [1_000_000n]],
    });

    console.log("Test USDC:      ", usdc.address);
    console.log("MilestonePools: ", pools.address);
  },
  { tags: ["MilestonePools"] },
);