import { createInterface } from "node:readline/promises";
import { deployScript, artifacts } from "../rocketh/deploy.js";
import { planFor } from "../rocketh/plan.js";

/** Formats a 6-decimal USDC amount without dropping fractions (1_500_000n -> "1.5"). */
const fmtUsdc = (units: bigint): string => {
  const whole = units / 1_000_000n;
  const frac = (units % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
};

/**
 * Real networks: the token and limits are permanent once deployed, so the person deploying must confirm them
 * by typing the chain ID. Without a terminal (scripts, CI), POOLS_CONFIRM_CHAIN_ID must be set to the chain ID.
 */
async function confirmRealDeploy(chainId: number): Promise<void> {
  const expected = String(chainId);
  const preset = process.env.POOLS_CONFIRM_CHAIN_ID;
  if (preset !== undefined) {
    if (preset.trim() !== expected) {
      throw new Error(`POOLS_CONFIRM_CHAIN_ID is ${preset}, but this network is chain ${expected}. Nothing deployed.`);
    }
    return;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      `Deploying to a real network needs confirmation. Run it in a terminal, or set POOLS_CONFIRM_CHAIN_ID=${expected}.`,
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`These values are permanent. Type the chain ID (${expected}) to deploy: `);
    if (answer.trim() !== expected) throw new Error("Not confirmed. Nothing deployed.");
  } finally {
    rl.close();
  }
}

/**
 * Deploys MilestonePools.
 *
 * The network is identified by the chain ID reported by the node, never by its name.
 * On local and test networks it also deploys a free test USDC (6 decimals) and uses generous limits.
 * On Base, Arbitrum and Optimism it uses Circle's real USDC and small beta limits (500 USDC per initiative,
 * 5,000 USDC held in total, unless overridden). Any other chain is refused. See ../rocketh/plan.ts.
 * Limits are fixed at deployment, so on a real network the script shows the token and limits and asks you to
 * type the chain ID before deploying (or reads POOLS_CONFIRM_CHAIN_ID when there is no terminal).
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
      console.log("Deployer:       ", deployer);
      console.log("USDC (Circle):  ", tokenAddress);
      console.log(
        `Limits: minimum ${fmtUsdc(plan.minimum)} USDC, goal limit ${fmtUsdc(plan.maxGoal)} USDC, total cap ${fmtUsdc(plan.totalCap)} USDC`,
      );
      await confirmRealDeploy(chainId);
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
