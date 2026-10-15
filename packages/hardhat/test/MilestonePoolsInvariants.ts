import { expect } from "chai";
import { network } from "hardhat";
import { DAY, makeRng, Phase, Status, usdc } from "./utils.js";

const { networkHelpers, ethers } = await network.create();
const { time } = networkHelpers;

const SEEDS = 25;
const STEPS = 220;

/**
 * Randomized multi-step runs. After EVERY step the following must hold exactly:
 *
 *   1. token balance of the pool == liabilities(token)
 *   2. liabilities(token) == unspent funds of live initiatives
 *                          + unclaimed refund pools of failed/cancelled initiatives
 *                          + credits not yet withdrawn
 *   3. no tokens are created or destroyed (pool + all actors == total minted)
 *   4. released <= raised, and released == sum of approved milestone amounts
 *
 * Calls that are expected to revert are allowed to revert; anything else fails the run.
 * Every assertion message carries the seed, so a failing run can be replayed exactly.
 */
async function runScenario(seed: number, stats: Record<string, number>) {
  const rng = makeRng(seed);
  const signers = await ethers.getSigners();
  const funders = signers.slice(1, 6);
  const grantees = signers.slice(6, 9);
  const reviewerPool = signers.slice(9, 18);
  const proposer = signers[18];

  const token = await ethers.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  const tokenAddr = await token.getAddress();
  const pools = await ethers.deployContract("MilestonePools", [[tokenAddr], [1n]]);
  const poolsAddr = await pools.getAddress();

  const MINT = usdc(5_000_000);
  const actors = [...funders, ...grantees, ...reviewerPool, proposer];
  for (const f of funders) {
    await token.mint(f.address, MINT);
    await token.connect(f).approve(poolsAddr, ethers.MaxUint256);
  }
  const totalMinted = MINT * BigInt(funders.length);

  const claimed = new Map<number, bigint>(); // id -> refunds paid out

  const allowedErrors = new Set([
    "WrongStatus",
    "WrongPhase",
    "FundingClosed",
    "BelowMinimum",
    "ExceedsGoal",
    "NothingToSettle",
    "NotGrantee",
    "NotReviewer",
    "AlreadyVoted",
    "ReviewWindowClosed",
    "ReviewWindowOpen",
    "SubmissionWindowOpen",
    "NothingToClaim",
    "InvalidCandidate",
  ]);

  async function attempt(name: string, call: () => Promise<any>) {
    try {
      const tx = await call();
      await tx.wait();
      stats[name] = (stats[name] ?? 0) + 1;
      return true;
    } catch (e: any) {
      const raw = e?.data ?? e?.error?.data ?? e?.info?.error?.data;
      const decoded = typeof raw === "string" && raw.length >= 10 ? pools.interface.parseError(raw) : null;
      if (decoded && allowedErrors.has(decoded.name)) {
        stats[`${name}:reverted`] = (stats[`${name}:reverted`] ?? 0) + 1;
        return false;
      }
      throw new Error(`seed ${seed}: unexpected failure in ${name}: ${e?.message ?? e}`);
    }
  }

  async function check(step: number, label: string) {
    const count = Number(await pools.initiativeCount());
    let expected = 0n;
    for (let id = 1; id <= count; id++) {
      const i = await pools.getInitiative(id);
      const status = Number(i.status);
      const amounts: bigint[] = await pools.getMilestoneAmounts(id);
      // 4. released consistency
      expect(i.released, `seed ${seed} step ${step} (${label}) released<=raised id ${id}`).to.be.lte(i.raised);
      const approved = Number(i.currentMilestone);
      const sum = amounts.slice(0, approved).reduce((a, b) => a + b, 0n);
      expect(i.released, `seed ${seed} step ${step} (${label}) released==approved sum id ${id}`).to.equal(sum);

      if (status === Status.Failed || status === Status.Cancelled) {
        expect(i.refundPool).to.equal(i.raised - i.released);
        expected += i.refundPool - (claimed.get(id) ?? 0n);
      } else {
        expected += i.raised - i.released;
      }
      if (status === Status.Completed) {
        expect(i.released).to.equal(i.raised);
      }
    }
    let credits = 0n;
    for (const a of actors) credits += await pools.credits(tokenAddr, a.address);
    expected += credits;

    const liabilities = await pools.liabilities(tokenAddr);
    const balance = await token.balanceOf(poolsAddr);
    expect(liabilities, `seed ${seed} step ${step} (${label}) liabilities`).to.equal(expected);
    expect(balance, `seed ${seed} step ${step} (${label}) balance==liabilities`).to.equal(liabilities);

    let total = balance;
    for (const a of actors) total += await token.balanceOf(a.address);
    expect(total, `seed ${seed} step ${step} (${label}) conservation`).to.equal(totalMinted);
  }

  const advanceTo = async (ts: bigint) => {
    if (BigInt(await time.latest()) < ts) await time.increaseTo(ts);
  };
  const byAddr = (a: string) => signers.find(x => x.address === a)!;

  for (let step = 0; step < STEPS; step++) {
    const count = Number(await pools.initiativeCount());
    let label = "";

    if (count === 0 || (count < 3 && rng.chance(0.08))) {
      label = "create";
      const rfp = rng.chance(0.35);
      const mCount = rng.int(1, 3);
      const milestoneAmounts = Array.from({ length: mCount }, () => usdc(rng.int(10, 500)));
      const rCount = rng.pick([3, 4, 5, 7, 9]);
      const reviewers = [...reviewerPool].sort(() => rng.next() - 0.5).slice(0, rCount);
      const threshold = Math.floor(rCount / 2) + 1 + rng.int(0, rCount - Math.floor(rCount / 2) - 1);
      await attempt(label, () =>
        pools.connect(proposer).createInitiative({
          token: tokenAddr,
          grantee: rfp ? ethers.ZeroAddress : rng.pick(grantees).address,
          milestoneAmounts,
          qualifyBps: rng.pick([1000, 2500, 5000, 10_000]),
          fundingDuration: rng.int(1, 40) * DAY,
          reviewers: reviewers.map(r => r.address),
          threshold,
          category: rng.int(0, 8),
          metadataURI: "ipfs://x",
        }),
      );
    } else {
      const id = rng.int(1, count);
      const i = await pools.getInitiative(id);
      const status = Number(i.status);
      const phase = Number(i.phase);
      const reviewers: string[] = await pools.getReviewers(id);
      const junk = rng.chance(0.12); // wrong actor / wrong moment, to exercise the guards

      if (junk) {
        const k = rng.int(0, 5);
        if (k === 0) {
          label = "voteMilestone";
          await attempt(label, () => pools.connect(rng.pick(funders)).voteMilestone(id, true));
        } else if (k === 1) {
          label = "submit";
          await attempt(label, () => pools.connect(rng.pick(funders)).submitMilestone(id, "x"));
        } else if (k === 2) {
          label = "settle";
          await attempt(label, () => pools.settle(id));
        } else if (k === 3) {
          label = "expireReview";
          await attempt(label, () => pools.expireReview(id));
        } else if (k === 4) {
          label = "cancelIdle";
          await attempt(label, () => pools.cancelIdle(id));
        } else {
          label = "contribute";
          await attempt(label, () => pools.connect(rng.pick(funders)).contribute(id, usdc(rng.int(1, 50))));
        }
      } else if (status === Status.Funding) {
        const r = rng.next();
        if (r < 0.85) {
          label = "contribute";
          const left = i.goal - i.raised;
          const slice = (i.goal * BigInt(rng.int(5, 60))) / 100n;
          const amount = left > 0n && rng.chance(0.4) ? left : slice > 0n ? slice : 1_000_000n;
          await attempt(label, () => pools.connect(rng.pick(funders)).contribute(id, amount));
        } else if (r < 0.93) {
          label = "time";
          await advanceTo(i.fundingDeadline + BigInt(rng.int(1, 3)));
        } else {
          label = "settle";
          await attempt(label, () => pools.settle(id));
        }
      } else if (status === Status.Selecting) {
        const r = rng.next();
        if (r < 0.8) {
          label = "voteGrantee";
          const voter = byAddr(rng.pick(reviewers));
          await attempt(label, () =>
            pools
              .connect(voter)
              .voteGrantee(id, rng.chance(0.85) ? grantees[id % grantees.length].address : rng.pick(grantees).address),
          );
        } else if (r < 0.9) {
          label = "applyAsGrantee";
          await attempt(label, () => pools.connect(rng.pick(grantees)).applyAsGrantee(id, "ipfs://pitch"));
        } else {
          label = "time";
          await advanceTo(i.selectionDeadline + 1n);
        }
      } else if (status === Status.Active && phase === Phase.AwaitingSubmission) {
        const r = rng.next();
        if (r < 0.8) {
          label = "submit";
          await attempt(label, () => pools.connect(byAddr(i.grantee)).submitMilestone(id, "ipfs://evidence"));
        } else if (r < 0.9) {
          label = "time";
          await time.increase(rng.int(20, 70) * DAY);
          await attempt("cancelIdle", () => pools.cancelIdle(id));
        } else {
          label = "cancelIdle";
          await attempt(label, () => pools.cancelIdle(id));
        }
      } else if (status === Status.Active && phase === Phase.UnderReview) {
        const r = rng.next();
        if (r < 0.85) {
          label = "voteMilestone";
          const approveBias = rng.pick([0.3, 0.7, 0.95]);
          await attempt(label, () =>
            pools.connect(byAddr(rng.pick(reviewers))).voteMilestone(id, rng.chance(approveBias)),
          );
        } else {
          label = "time";
          await time.increase(rng.int(1, 16) * DAY);
          await attempt("expireReview", () => pools.expireReview(id));
        }
      } else {
        // Completed / Failed / Cancelled: claim things
        const r = rng.next();
        if (r < 0.65) {
          label = "refund";
          const who = rng.pick(funders);
          const expectedAmount = await pools.refundableOf(id, who.address);
          const ok = await attempt(label, () => pools.connect(who).refund(id));
          if (ok) claimed.set(id, (claimed.get(id) ?? 0n) + expectedAmount);
        } else {
          label = "withdraw";
          const who = rng.pick(grantees);
          await attempt(label, () => pools.connect(who).withdraw(tokenAddr));
        }
      }
    }
    await check(step, label);
  }

  for (let id = 1; id <= Number(await pools.initiativeCount()); id++) {
    const st = Number((await pools.getInitiative(id)).status);
    const names = ["Funding", "Selecting", "Active", "Completed", "Failed", "Cancelled"];
    stats[`final:${names[st]}`] = (stats[`final:${names[st]}`] ?? 0) + 1;
  }

  // Wind down: let every deadline pass, settle everything, drain every claim.
  await time.increase(200 * DAY);
  const count = Number(await pools.initiativeCount());
  for (let id = 1; id <= count; id++) {
    await attempt("settle", () => pools.settle(id));
    for (let k = 0; k < 4; k++) {
      await attempt("expireReview", () => pools.expireReview(id));
      await time.increase(15 * DAY);
      await attempt("settle", () => pools.settle(id));
    }
    await time.increase(61 * DAY);
    await attempt("cancelIdle", () => pools.cancelIdle(id));
  }
  for (let id = 1; id <= count; id++) {
    for (const f of funders) {
      const owed = await pools.refundableOf(id, f.address);
      if (await attempt("refund", () => pools.connect(f).refund(id))) claimed.set(id, (claimed.get(id) ?? 0n) + owed);
    }
  }
  for (const g of grantees) await attempt("withdraw", () => pools.connect(g).withdraw(tokenAddr));
  await check(STEPS, "wind-down");

  // After everything is claimed, what remains is rounding dust only: at most one unit per backer
  // of each failed or cancelled initiative, and still fully accounted for in `liabilities`.
  let dustCeiling = 0n;
  for (let id = 1; id <= count; id++) {
    const i = await pools.getInitiative(id);
    const st = Number(i.status);
    if (st === Status.Failed || st === Status.Cancelled) dustCeiling += BigInt(i.backers);
  }
  const leftover = await token.balanceOf(poolsAddr);
  expect(leftover, `seed ${seed} leftover dust`).to.be.lte(dustCeiling);
}

describe("MilestonePools: randomized invariants", function () {
  this.timeout(600_000);

  const stats: Record<string, number> = {};

  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`seed ${seed}: balance == liabilities, conservation, exact accounting after every step`, async function () {
      await runScenario(seed * 7919, stats);
    });
  }

  after(function () {
    console.log("\n    action coverage:", JSON.stringify(stats));
    // Coverage check: the random walk must actually have exercised the interesting paths.
    const need = [
      "create",
      "contribute",
      "settle",
      "voteGrantee",
      "submit",
      "voteMilestone",
      "expireReview",
      "cancelIdle",
      "refund",
      "withdraw",
      "final:Completed",
      "final:Failed",
      "final:Cancelled",
    ];
    for (const k of need) expect(stats[k] ?? 0, `no successful ${k} across all seeds`).to.be.gt(0);
  });
});
