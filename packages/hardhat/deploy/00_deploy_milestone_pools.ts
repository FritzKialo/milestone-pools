import { deployScript, artifacts } from "../rocketh/deploy.js";
import { planFor } from "../rocketh/plan.js";

/**
 * Deploys MilestonePools.
 *
 * The network is identified by the chain ID reported by the node, never by its name.
 * On local and test networks it also deploys a free test USDC (6 decimals) and uses generous limits.
 * On Base, Arbitrum and Optimism it uses Circle's real USDC and small beta limits (500 USDC per initiative,
 * 5,000 USDC held in total, unless overridden). Any other chain is refused. See ../rocketh/plan.ts.
 * Limits are fixed at deployment.
 */
export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;
    const chainId = Number(await env.network.provider.request({ method: "eth_chainId" }));
    if (chainId !== env.network.chain.id) {
      throw new Error(`The node reports chain ${chainId}, but the configuration expects ${env.network.chain.id}.`);
    }
    const plan = planFor(chainId);
    console.log(`Network:         ${env.name} (chain ${chainId}), ${plan.mock ? "test network" : "real network"}`);

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
