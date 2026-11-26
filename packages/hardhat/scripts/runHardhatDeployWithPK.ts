import "dotenv/config";
import { Wallet } from "ethers";
import password from "@inquirer/password";
import { spawn } from "child_process";

/** Networks that run locally and use the node's own accounts, so no deployer key is needed. */
const LOCAL_NETWORKS = new Set(["default", "hardhat", "localhost"]);

/** Reads the network from `--network <name>` or `--network=<name>`. No flag means the local default network. */
function networkFromArgs(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--network=")) return arg.slice("--network=".length);
    if (arg === "--network") {
      const name = args[i + 1];
      if (!name || name.startsWith("--")) throw new Error("`--network` needs a network name.");
      return name;
    }
  }
  return "default";
}

/**
 * Unencrypts the private key and runs the hardhat deploy command,
 * then generates TypeScript ABIs for the frontend.
 * Any network that is not explicitly local is treated as real and needs the encrypted deployer key.
 * The deploy script itself asks for confirmation of the token and limits on real networks.
 */
async function main() {
  const args = process.argv.slice(2);
  const networkName = networkFromArgs(args);

  if (!LOCAL_NETWORKS.has(networkName)) {
    const encryptedKey = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;

    if (!encryptedKey) {
      console.error("🚫️ You don't have a deployer account. Run `yarn generate` or `yarn account:import` first");
      process.exit(1);
    }

    const pass = await password({ message: "Enter password to decrypt private key:" });

    try {
      const wallet = await Wallet.fromEncryptedJson(encryptedKey, pass);
      process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY = wallet.privateKey;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      console.error("Failed to decrypt private key. Wrong password?");
      process.exit(1);
    }
  }

  // Run hardhat deploy (compilation already handled by the npm script).
  // hardhat-deploy's own prompt is skipped; real networks are confirmed in deploy/00_deploy_milestone_pools.ts.
  const deployArgs = ["deploy", "--no-compile", "--skip-prompts", ...args];

  const hardhat = spawn("hardhat", deployArgs, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  hardhat.on("exit", (code, signal) => {
    if (signal) {
      console.error(`hardhat deploy was stopped by ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
