import "dotenv/config";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import password from "@inquirer/password";
import { Wallet } from "ethers";
import { createPublicClient, createWalletClient, formatEther, http, parseEther, parseUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Fills the Sepolia demo contract with sample initiatives so the site has something to show.
 *
 * Run from packages/hardhat:   yarn tsx scripts/seedSepolia.ts
 *
 * It uses your deployer wallet and a few throwaway wallets made on the fly (they act as the review
 * committee and the grantee, and get a tiny amount of Sepolia ETH for gas). Funding uses the free test USDC.
 * Nothing here touches real money, and the throwaway keys are never saved.
 */

const here = dirname(fileURLToPath(import.meta.url));
const deployment = (name: string) =>
  JSON.parse(
    readFileSync(join(here, "..", "deployments", process.env.SEED_DEPLOYMENT ?? "sepolia", `${name}.json`), "utf8"),
  );

const providerApiKey = process.env.ALCHEMY_API_KEY || "IZYEU2cWBgnFmgiTAgpWD";
const rpcUrl = process.env.SEED_RPC_URL ?? `https://eth-sepolia.g.alchemy.com/v2/${providerApiKey}`;

const U = (n: number) => parseUnits(String(n), 6);
const meta = (m: unknown) => `data:application/json;base64,${Buffer.from(JSON.stringify(m)).toString("base64")}`;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

async function deployerKey(): Promise<`0x${string}`> {
  if (process.env.SEED_PRIVATE_KEY) return process.env.SEED_PRIVATE_KEY as `0x${string}`;
  const encrypted = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  if (!encrypted) throw new Error("No deployer account found. Run `yarn account:import` first.");
  const pass = await password({ message: "Enter password to decrypt private key:" });
  try {
    return (await Wallet.fromEncryptedJson(encrypted, pass)).privateKey as `0x${string}`;
  } catch {
    throw new Error("Failed to decrypt private key. Wrong password?");
  }
}

async function main() {
  const pools = deployment("MilestonePools");
  const usdc = deployment("MockUSDC");
  const transport = http(rpcUrl);
  const pub = createPublicClient({ transport });

  const owner = privateKeyToAccount(await deployerKey());
  const reviewers = [0, 1, 2].map(() => privateKeyToAccount(generatePrivateKey()));
  const grantee = privateKeyToAccount(generatePrivateKey());
  const helpers = [...reviewers, grantee];
  const wallet = (account: ReturnType<typeof privateKeyToAccount>) => createWalletClient({ account, transport });
  const ownerWallet = wallet(owner);

  const GAS_EACH = parseEther("0.0006");
  const balance = await pub.getBalance({ address: owner.address });
  console.log(`Deployer ${owner.address} has ${formatEther(balance)} ETH`);
  if (balance < GAS_EACH * BigInt(helpers.length) + parseEther("0.002")) {
    throw new Error("Not enough ETH on the deployer wallet. Add a little Sepolia ETH and run again.");
  }

  const send = async (
    from: ReturnType<typeof privateKeyToAccount>,
    address: `0x${string}`,
    abi: unknown,
    functionName: string,
    args: unknown[],
  ) => {
    const hash = await wallet(from).writeContract({ address, abi, functionName, args } as never);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${functionName} failed: ${hash}`);
  };
  const poolTx = (from: ReturnType<typeof privateKeyToAccount>, fn: string, args: unknown[]) =>
    send(from, pools.address, pools.abi, fn, args);
  const count = async () =>
    Number(
      await pub.readContract({ address: pools.address, abi: pools.abi, functionName: "initiativeCount" } as never),
    );

  console.log("Giving the helper wallets a little gas...");
  for (const h of helpers) {
    const hash = await ownerWallet.sendTransaction({ to: h.address, value: GAS_EACH, chain: undefined });
    await pub.waitForTransactionReceipt({ hash });
  }

  console.log("Minting and approving test USDC...");
  await send(owner, usdc.address, usdc.abi, "mint", [owner.address, U(10000)]);
  await send(owner, usdc.address, usdc.abi, "approve", [pools.address, U(10000)]);

  const create = async (over: Record<string, unknown>) => {
    await poolTx(owner, "createInitiative", [
      {
        token: usdc.address,
        grantee: grantee.address,
        milestoneAmounts: [U(300), U(400), U(300)],
        qualifyBps: 5000,
        fundingDuration: BigInt(30 * 86400),
        reviewers: reviewers.map(r => r.address),
        threshold: 2,
        category: 4,
        metadataURI: "",
        ...over,
      },
    ]);
    return count();
  };
  const fund = (id: number, amount: number) => poolTx(owner, "contribute", [BigInt(id), U(amount)]);

  console.log("1/5 Active initiative with a payout and a milestone in review...");
  let id = await create({
    category: 1,
    metadataURI: meta({
      title: "Community workshop series",
      summary: "Ten free workshops teaching smart contract basics in Nairobi.",
      body: "We will run ten in-person workshops over three months.\n\nEach one ends with a small project people can show.",
      milestones: ["Venue and curriculum", "First five workshops", "Last five workshops"],
      faq: [{ q: "Who can attend?", a: "Anyone. No experience needed." }],
    }),
  });
  await fund(id, 1000);
  await poolTx(grantee, "submitMilestone", [BigInt(id), "https://example.com/evidence/1"]);
  await poolTx(reviewers[0], "voteMilestone", [BigInt(id), true]);
  await poolTx(reviewers[1], "voteMilestone", [BigInt(id), true]);
  await poolTx(grantee, "submitMilestone", [BigInt(id), "https://example.com/evidence/2"]);
  await poolTx(reviewers[0], "voteMilestone", [BigInt(id), true]);

  console.log("2/5 Initiative about 40% funded...");
  id = await create({
    category: 3,
    milestoneAmounts: [U(250), U(250)],
    metadataURI: meta({
      title: "Open dataset of mobile money fees",
      summary: "A public, regularly updated dataset comparing mobile money fees across East Africa.",
      milestones: ["Collect first dataset", "Publish and maintain"],
    }),
  });
  await fund(id, 200);

  console.log("3/5 Initiative about 80% funded...");
  id = await create({
    category: 5,
    milestoneAmounts: [U(200), U(200)],
    metadataURI: meta({
      title: "Wallet testing toolkit",
      summary: "Open source tools to test wallets against common scam patterns.",
      milestones: ["Core test runner", "Report generator"],
    }),
  });
  await fund(id, 320);

  console.log("4/5 Completed initiative...");
  id = await create({
    category: 0,
    milestoneAmounts: [U(50), U(50)],
    metadataURI: meta({
      title: "Translate the docs into Swahili",
      summary: "Full Swahili translation of the beginner guides.",
      milestones: ["First half", "Second half"],
    }),
  });
  await fund(id, 100);
  for (const n of [1, 2]) {
    await poolTx(grantee, "submitMilestone", [BigInt(id), `https://example.com/swahili/${n}`]);
    await poolTx(reviewers[0], "voteMilestone", [BigInt(id), true]);
    await poolTx(reviewers[1], "voteMilestone", [BigInt(id), true]);
  }

  console.log("5/5 Open call where the committee picks the grantee...");
  await create({
    category: 2,
    grantee: ZERO,
    milestoneAmounts: [U(400), U(400)],
    metadataURI: meta({
      title: "Community RPC node for the region",
      summary: "Looking for a team to run a reliable public node. The committee will choose who.",
      milestones: ["Run the node for three months", "Publish uptime report"],
    }),
  }).then(openId => fund(openId, 250));

  console.log(`\nDone. The contract now has ${await count()} sample initiatives.`);
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
