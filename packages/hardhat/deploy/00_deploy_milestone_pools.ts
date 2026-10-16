import { deployScript, artifacts } from "../rocketh/deploy.js";
import { planFor } from "../rocketh/plan.js";

/**
 * Deploys MilestonePools.
 *
 * On local and test networks it also deploys a free test USDC (6 decimals) and uses generous limits.
 * On Base, Arbitrum and Optimism it uses Circle's real USDC and small beta limits (500 USDC per initiative,
 * 5,000 USDC held in total, unless overridden). See ../rocketh/plan.ts. Limits are fixed at deployment.
 */
export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;
    const networkName = (env as unknown as { network: { name: string } }).network.name;
    const plan = planFor(networkName);

    let tokenAddress = plan.token as `0x${string}` | undefined;
    if (plan.mock) {
      const usdc = await env.deploy("MockUSDC", {
        account: deployer,
        artifact: artifacts.MockERC20,
        args: ["USD Coin (test)", "USDC", 6],
      });
      tokenAddress = usdc.address;
      console.log("Test USDC:      ", usdc.address);
    } else {
      console.log("USDC (Circle):  ", tokenAddress);
      console.log(
        `Limits: minimum ${plan.minimum / 1_000_000n} USDC, goal limit ${plan.maxGoal / 1_000_000n} USDC, total cap ${plan.totalCap / 1_000_000n} USDC`,
      );
    }

    const pools = await env.deploy("MilestonePools", {
      account: deployer,
      artifact: artifacts.MilestonePools,
      // allowlist; minimum contribution; largest goal per initiative; most the contract may hold at once
      args: [[tokenAddress as `0x${string}`], [plan.minimum], [plan.maxGoal], [plan.totalCap]],
    });

    console.log("MilestonePools: ", pools.address);
  },
  { tags: ["MilestonePools"] },
);
