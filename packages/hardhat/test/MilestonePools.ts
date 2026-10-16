import { expect } from "chai";
import { network } from "hardhat";
import { DAY, Phase, REVIEW_PERIOD, SELECTION_PERIOD, Status, SUBMISSION_WINDOW, usdc } from "./utils.js";

const { networkHelpers, ethers } = await network.create();
const { time, loadFixture } = networkHelpers;

const ZERO = ethers.ZeroAddress;

async function fixture() {
  const [deployer, proposer, grantee, alice, bob, carol, r1, r2, r3, r4, r5, outsider, candidate] =
    await ethers.getSigners();

  const token = await ethers.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  const feeToken = await ethers.deployContract("FeeOnTransferToken");
  const reToken = await ethers.deployContract("ReenteringToken");
  const pools = await ethers.deployContract("MilestonePools", [
    [await token.getAddress(), await feeToken.getAddress(), await reToken.getAddress()],
    [usdc(1), 1n, 1n],
    [10n ** 30n, 10n ** 30n, 10n ** 30n],
    [10n ** 31n, 10n ** 31n, 10n ** 31n],
  ]);
  const poolsAddr = await pools.getAddress();

  for (const f of [alice, bob, carol]) {
    for (const t of [token, feeToken, reToken]) {
      await t.mint(f.address, usdc(1_000_000));
      await t.connect(f).approve(poolsAddr, ethers.MaxUint256);
    }
  }

  const reviewers = [r1, r2, r3, r4, r5];
  const reviewerAddrs = reviewers.map(r => r.address);

  /** Create an initiative. Defaults: Grant, 1000 USDC in 400/300/300, 5 reviewers, 3 to approve, 25% to qualify. */
  async function create(overrides: Record<string, any> = {}) {
    const params = {
      token: await token.getAddress(),
      grantee: grantee.address,
      milestoneAmounts: [usdc(400), usdc(300), usdc(300)],
      qualifyBps: 2500,
      fundingDuration: 30 * DAY,
      reviewers: reviewerAddrs,
      threshold: 3,
      category: 1,
      metadataURI: "ipfs://proposal",
      ...overrides,
    };
    await pools.connect(proposer).createInitiative(params);
    const id = await pools.initiativeCount();
    return { id, params };
  }

  async function ini(id: bigint) {
    return pools.getInitiative(id);
  }

  /** Fully fund with alice 600 / bob 400 and return. Initiative becomes Active (Grant) or Selecting (RFP). */
  async function fundFully(id: bigint, amounts: [bigint, bigint] = [usdc(600), usdc(400)]) {
    await pools.connect(alice).contribute(id, amounts[0]);
    await pools.connect(bob).contribute(id, amounts[1]);
  }

  async function approveWith(id: bigint, n = 3) {
    for (let i = 0; i < n; i++) await pools.connect(reviewers[i]).voteMilestone(id, true);
  }

  /** Grant that is fully funded and active. */
  async function activeGrant(overrides: Record<string, any> = {}) {
    const { id, params } = await create(overrides);
    await fundFully(id);
    return { id, params };
  }

  return {
    deployer,
    proposer,
    grantee,
    alice,
    bob,
    carol,
    reviewers,
    outsider,
    candidate,
    token,
    feeToken,
    reToken,
    pools,
    poolsAddr,
    create,
    ini,
    fundFully,
    approveWith,
    activeGrant,
  };
}

describe("MilestonePools", function () {
  describe("deployment", function () {
    it("stores the token allowlist and minimums, and starts empty", async function () {
      const { pools, token, feeToken } = await loadFixture(fixture);
      expect(await pools.minContribution(await token.getAddress())).to.equal(usdc(1));
      expect(await pools.minContribution(await feeToken.getAddress())).to.equal(1n);
      expect(await pools.minContribution(ZERO)).to.equal(0n);
      expect(await pools.initiativeCount()).to.equal(0n);
    });

    it("rejects bad constructor input", async function () {
      const { token } = await loadFixture(fixture);
      const t = await token.getAddress();
      const big = 10n ** 30n;
      const deploy = (a: string[], m: bigint[], g: bigint[] = m.map(() => big), c: bigint[] = m.map(() => big * 10n)) =>
        ethers.deployContract("MilestonePools", [a, m, g, c]);
      const probe = await ethers.getContractFactory("MilestonePools");

      await expect(deploy([], [])).to.be.revertedWithCustomError(probe, "NoTokens");
      await expect(deploy([t], [1n, 2n])).to.be.revertedWithCustomError(probe, "LengthMismatch");
      await expect(deploy([t], [0n])).to.be.revertedWithCustomError(probe, "InvalidMinimum");
      await expect(deploy([t, t], [1n, 1n])).to.be.revertedWithCustomError(probe, "DuplicateToken");
      await expect(deploy([ZERO], [1n])).to.be.revertedWithCustomError(probe, "InvalidToken");
      const [eoa] = await ethers.getSigners();
      await expect(deploy([eoa.address], [1n])).to.be.revertedWithCustomError(probe, "InvalidToken");
      // limits must line up with the tokens, goal limit >= minimum, total cap >= goal limit
      await expect(deploy([t], [1n], [big, big])).to.be.revertedWithCustomError(probe, "LengthMismatch");
      await expect(deploy([t], [1n], [big], [])).to.be.revertedWithCustomError(probe, "LengthMismatch");
      await expect(deploy([t], [10n], [9n], [big])).to.be.revertedWithCustomError(probe, "InvalidLimit");
      await expect(deploy([t], [1n], [100n], [99n])).to.be.revertedWithCustomError(probe, "InvalidLimit");
      await deploy([t], [10n], [10n], [10n]); // equal limits are fine
    });

    it("stores the goal limit and total cap per token", async function () {
      const { pools, token, feeToken } = await loadFixture(fixture);
      expect(await pools.maxGoal(await token.getAddress())).to.equal(10n ** 30n);
      expect(await pools.totalCap(await feeToken.getAddress())).to.equal(10n ** 31n);
      expect(await pools.maxGoal(ZERO)).to.equal(0n);
    });

    it("rejects more than MAX_TOKENS tokens", async function () {
      const probe = await ethers.getContractFactory("MilestonePools");
      const addrs: string[] = [];
      for (let i = 0; i < 21; i++) {
        const t = await ethers.deployContract("MockERC20", ["T", "T", 18]);
        addrs.push(await t.getAddress());
      }
      const lim = (n: number) => [
        addrs.slice(0, n).map(() => 1n),
        addrs.slice(0, n).map(() => 10n),
        addrs.slice(0, n).map(() => 10n),
      ];
      await expect(ethers.deployContract("MilestonePools", [addrs, ...lim(21)])).to.be.revertedWithCustomError(
        probe,
        "TooManyTokens",
      );
      await ethers.deployContract("MilestonePools", [addrs.slice(0, 20), ...lim(20)]);
    });
  });

  describe("createInitiative", function () {
    it("creates a Grant, emits both events and stores the plan", async function () {
      const { pools, proposer, grantee, reviewers, token, create, ini } = await loadFixture(fixture);
      const { id, params } = await create();
      expect(id).to.equal(1n);

      const i = await ini(id);
      expect(i.token).to.equal(await token.getAddress());
      expect(i.grantee).to.equal(grantee.address);
      expect(i.proposer).to.equal(proposer.address);
      expect(i.goal).to.equal(usdc(1000));
      expect(i.raised).to.equal(0n);
      expect(i.threshold).to.equal(3n);
      expect(i.reviewerCount).to.equal(5n);
      expect(Number(i.status)).to.equal(Status.Funding);
      expect(Number(i.phase)).to.equal(Phase.AwaitingSubmission);
      expect(await pools.getMilestoneAmounts(id)).to.deep.equal(params.milestoneAmounts);
      expect(await pools.getReviewers(id)).to.deep.equal(reviewers.map(r => r.address));
      expect(await pools.isReviewer(id, reviewers[0].address)).to.equal(true);
      expect(await pools.isReviewer(id, grantee.address)).to.equal(false);
    });

    it("emits InitiativeCreated and InitiativeDetails", async function () {
      const { pools, proposer, token } = await loadFixture(fixture);
      const tx = pools.connect(proposer).createInitiative({
        token: await token.getAddress(),
        grantee: ZERO,
        milestoneAmounts: [usdc(10)],
        qualifyBps: 10_000,
        fundingDuration: DAY,
        reviewers: (await ethers.getSigners()).slice(6, 9).map(s => s.address),
        threshold: 2,
        category: 7,
        metadataURI: "https://example.org/p",
      });
      await expect(tx).to.emit(pools, "InitiativeCreated");
      await expect(tx).to.emit(pools, "InitiativeDetails");
    });

    it("allows an RFP (no grantee yet)", async function () {
      const { create, ini } = await loadFixture(fixture);
      const { id } = await create({ grantee: ZERO });
      expect((await ini(id)).grantee).to.equal(ZERO);
    });

    it("validates every parameter", async function () {
      const { pools, create, reviewers, outsider } = await loadFixture(fixture);
      const addrs = reviewers.map(r => r.address);

      await expect(create({ token: outsider.address })).to.be.revertedWithCustomError(pools, "TokenNotAllowed");
      await expect(create({ qualifyBps: 999 })).to.be.revertedWithCustomError(pools, "InvalidQualifyBps");
      await expect(create({ qualifyBps: 10_001 })).to.be.revertedWithCustomError(pools, "InvalidQualifyBps");
      await create({ qualifyBps: 1000 });
      await create({ qualifyBps: 10_000 });
      await expect(create({ fundingDuration: DAY - 1 })).to.be.revertedWithCustomError(pools, "InvalidDuration");
      await expect(create({ fundingDuration: 90 * DAY + 1 })).to.be.revertedWithCustomError(pools, "InvalidDuration");
      await create({ fundingDuration: DAY });
      await create({ fundingDuration: 90 * DAY });
      await expect(create({ milestoneAmounts: [] })).to.be.revertedWithCustomError(pools, "InvalidMilestones");
      await expect(create({ milestoneAmounts: [usdc(1), 0n] })).to.be.revertedWithCustomError(
        pools,
        "InvalidMilestones",
      );
      await expect(create({ milestoneAmounts: new Array(11).fill(usdc(1)) })).to.be.revertedWithCustomError(
        pools,
        "InvalidMilestones",
      );
      await create({ milestoneAmounts: new Array(10).fill(usdc(1)) });
      await expect(create({ reviewers: addrs.slice(0, 2), threshold: 2 })).to.be.revertedWithCustomError(
        pools,
        "InvalidReviewers",
      );
      await expect(create({ reviewers: [...addrs, ...addrs] })).to.be.revertedWithCustomError(
        pools,
        "InvalidReviewers",
      );
      await expect(create({ reviewers: [addrs[0], addrs[0], addrs[1]], threshold: 2 })).to.be.revertedWithCustomError(
        pools,
        "InvalidReviewers",
      );
      await expect(create({ reviewers: [ZERO, addrs[1], addrs[2]], threshold: 2 })).to.be.revertedWithCustomError(
        pools,
        "InvalidReviewers",
      );
      // threshold must be a strict majority: 3 of 5 ok, 2 of 5 not, 6 of 5 not
      await expect(create({ threshold: 2 })).to.be.revertedWithCustomError(pools, "InvalidThreshold");
      await expect(create({ threshold: 6 })).to.be.revertedWithCustomError(pools, "InvalidThreshold");
      await expect(create({ reviewers: addrs.slice(0, 4), threshold: 2 })).to.be.revertedWithCustomError(
        pools,
        "InvalidThreshold",
      );
      await create({ reviewers: addrs.slice(0, 4), threshold: 3 });
      await create({ reviewers: addrs.slice(0, 4), threshold: 4 });
      // grantee cannot sit on their own committee
      await expect(create({ grantee: addrs[0] })).to.be.revertedWithCustomError(pools, "InvalidGrantee");
    });
  });

  describe("contribute", function () {
    it("records the contribution, counts backers once, and moves tokens", async function () {
      const { pools, poolsAddr, token, alice, bob, create, ini } = await loadFixture(fixture);
      const { id } = await create();
      await expect(pools.connect(alice).contribute(id, usdc(100)))
        .to.emit(pools, "Contributed")
        .withArgs(id, alice.address, usdc(100), usdc(100));
      await pools.connect(alice).contribute(id, usdc(50));
      await pools.connect(bob).contribute(id, usdc(25));

      const i = await ini(id);
      expect(i.raised).to.equal(usdc(175));
      expect(i.backers).to.equal(2n);
      expect(await pools.contributions(id, alice.address)).to.equal(usdc(150));
      expect(await token.balanceOf(poolsAddr)).to.equal(usdc(175));
      expect(await pools.liabilities(await token.getAddress())).to.equal(usdc(175));
      expect(Number(i.status)).to.equal(Status.Funding);
    });

    it("enforces the minimum, the goal cap and unknown ids", async function () {
      const { pools, alice, create } = await loadFixture(fixture);
      const { id } = await create();
      await expect(pools.connect(alice).contribute(id, usdc(1) - 1n)).to.be.revertedWithCustomError(
        pools,
        "BelowMinimum",
      );
      await pools.connect(alice).contribute(id, usdc(1));
      await expect(pools.connect(alice).contribute(id, usdc(1000))).to.be.revertedWithCustomError(pools, "ExceedsGoal");
      await pools.connect(alice).contribute(id, usdc(999)); // exactly the remainder
      await expect(pools.connect(alice).contribute(0, usdc(1))).to.be.revertedWithCustomError(
        pools,
        "UnknownInitiative",
      );
      await expect(pools.connect(alice).contribute(99, usdc(1))).to.be.revertedWithCustomError(
        pools,
        "UnknownInitiative",
      );
    });

    it("lets the final contribution fill a gap smaller than the minimum, and nothing else below it", async function () {
      const { pools, alice, bob, create, ini } = await loadFixture(fixture);
      // goal 10.5 USDC, minimum 1 USDC: after 10 USDC the gap (0.5) is below the minimum
      const { id } = await create({ milestoneAmounts: [usdc(5), usdc(5) + 500_000n] });
      await pools.connect(alice).contribute(id, usdc(10));
      await expect(pools.connect(bob).contribute(id, 499_999n)).to.be.revertedWithCustomError(pools, "BelowMinimum");
      await expect(pools.connect(bob).contribute(id, usdc(1))).to.be.revertedWithCustomError(pools, "ExceedsGoal");
      await pools.connect(bob).contribute(id, 500_000n);
      const i = await ini(id);
      expect(i.raised).to.equal(i.goal);
      expect(Number(i.status)).to.equal(Status.Active);
    });

    it("never lets a scaled-down milestone round to zero", async function () {
      const { pools, alice, create, ini } = await loadFixture(fixture);
      // at 25% qualification a milestone needs at least 4 base units; at 10%, at least 10
      await expect(create({ qualifyBps: 2500, milestoneAmounts: [3n, usdc(1)] })).to.be.revertedWithCustomError(
        pools,
        "InvalidMilestones",
      );
      await create({ qualifyBps: 2500, milestoneAmounts: [4n, usdc(1)] });
      await expect(create({ qualifyBps: 1000, milestoneAmounts: [9n, usdc(100)] })).to.be.revertedWithCustomError(
        pools,
        "InvalidMilestones",
      );
      // the tightest case: smallest allowed milestone, smallest qualifying raise (exactly 10%)
      const { id } = await create({ qualifyBps: 1000, milestoneAmounts: [10n, usdc(100)] });
      await pools.connect(alice).contribute(id, 10_000_001n);
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await pools.settle(id);
      const amounts: bigint[] = await pools.getMilestoneAmounts(id);
      expect(amounts.every(a => a > 0n)).to.equal(true);
      expect(amounts.reduce((a, b) => a + b, 0n)).to.equal(10_000_001n);
    });

    describe("beta limits", function () {
      async function limited() {
        const base = await loadFixture(fixture);
        const { alice, bob, grantee, reviewers } = base;
        // goal limit 500 USDC, total cap 600 USDC
        const t = await ethers.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
        const tAddr = await t.getAddress();
        const p = await ethers.deployContract("MilestonePools", [[tAddr], [usdc(1)], [usdc(500)], [usdc(600)]]);
        for (const f of [alice, bob]) {
          await t.mint(f.address, usdc(10_000));
          await t.connect(f).approve(await p.getAddress(), ethers.MaxUint256);
        }
        const make = (goal: bigint) =>
          p.connect(alice).createInitiative({
            token: tAddr,
            grantee: grantee.address,
            milestoneAmounts: [goal],
            qualifyBps: 2500,
            fundingDuration: 30 * DAY,
            reviewers: reviewers.slice(0, 3).map(r => r.address),
            threshold: 2,
            category: 1,
            metadataURI: "ipfs://x",
          });
        return { ...base, t, tAddr, p, make };
      }

      it("rejects a goal above the per-initiative limit and accepts exactly the limit", async function () {
        const { p, make } = await limited();
        await expect(make(usdc(500) + 1n)).to.be.revertedWithCustomError(p, "GoalTooLarge");
        await make(usdc(500));
        expect(await p.initiativeCount()).to.equal(1n);
      });

      it("stops contributions that push total holdings over the cap, and frees room after a payout", async function () {
        const { p, tAddr, make, alice, bob, grantee, reviewers } = await limited();
        await make(usdc(500));
        await make(usdc(500));
        await p.connect(alice).contribute(1, usdc(500)); // holdings 500, initiative 1 is Active
        await expect(p.connect(bob).contribute(2, usdc(101))).to.be.revertedWithCustomError(p, "CapReached");
        await p.connect(bob).contribute(2, usdc(100)); // holdings exactly 600
        await expect(p.connect(bob).contribute(2, usdc(1))).to.be.revertedWithCustomError(p, "CapReached");

        // pay out initiative 1 and let the grantee withdraw: holdings fall to 100
        await p.connect(grantee).submitMilestone(1, "ipfs://evidence");
        await p.connect(reviewers[0]).voteMilestone(1, true);
        await p.connect(reviewers[1]).voteMilestone(1, true);
        await p.connect(grantee).withdraw(tAddr);
        expect(await p.liabilities(tAddr)).to.equal(usdc(100));

        await p.connect(bob).contribute(2, usdc(101)); // room again
        expect(await p.liabilities(tAddr)).to.equal(usdc(201));
      });
    });

    it("closes exactly one second after the deadline", async function () {
      const { pools, alice, create, ini } = await loadFixture(fixture);
      const { id } = await create();
      const deadline = (await ini(id)).fundingDeadline;
      await time.setNextBlockTimestamp(deadline); // block.timestamp == deadline: still open
      await pools.connect(alice).contribute(id, usdc(10));
      await time.setNextBlockTimestamp(deadline + 1n);
      await expect(pools.connect(alice).contribute(id, usdc(10))).to.be.revertedWithCustomError(pools, "FundingClosed");
    });

    it("rejects fee-on-transfer tokens and leaves no state behind", async function () {
      const { pools, feeToken, alice, create, ini } = await loadFixture(fixture);
      const { id } = await create({ token: await feeToken.getAddress(), milestoneAmounts: [1000n] });
      await expect(pools.connect(alice).contribute(id, 500n)).to.be.revertedWithCustomError(
        pools,
        "FeeOnTransferToken",
      );
      expect((await ini(id)).raised).to.equal(0n);
      expect(await pools.liabilities(await feeToken.getAddress())).to.equal(0n);
    });

    it("hitting the goal activates a Grant immediately", async function () {
      const { pools, activeGrant, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      const i = await ini(id);
      expect(Number(i.status)).to.equal(Status.Active);
      expect(i.raised).to.equal(usdc(1000));
      expect(await pools.getMilestoneAmounts(id)).to.deep.equal([usdc(400), usdc(300), usdc(300)]);
    });

    it("hitting the goal moves an RFP to Selecting with a 30 day window", async function () {
      const { create, fundFully, ini } = await loadFixture(fixture);
      const { id } = await create({ grantee: ZERO });
      await fundFully(id);
      const i = await ini(id);
      expect(Number(i.status)).to.equal(Status.Selecting);
      expect(i.selectionDeadline).to.equal((await time.latest()) + SELECTION_PERIOD);
    });

    it("refuses contributions once the initiative is no longer Funding", async function () {
      const { pools, carol, activeGrant } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await expect(pools.connect(carol).contribute(id, usdc(1))).to.be.revertedWithCustomError(pools, "WrongStatus");
    });
  });

  describe("settle (funding deadline)", function () {
    it("does nothing before or at the deadline", async function () {
      const { pools, create, ini, alice } = await loadFixture(fixture);
      const { id } = await create();
      await pools.connect(alice).contribute(id, usdc(300));
      await expect(pools.settle(id)).to.be.revertedWithCustomError(pools, "NothingToSettle");
      await time.setNextBlockTimestamp((await ini(id)).fundingDeadline);
      await expect(pools.settle(id)).to.be.revertedWithCustomError(pools, "NothingToSettle");
    });

    it("proceeds with a scaled plan when the qualification threshold is met", async function () {
      const { pools, create, ini, alice } = await loadFixture(fixture);
      const { id } = await create();
      await pools.connect(alice).contribute(id, usdc(500)); // 50% of 1000
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await expect(pools.settle(id)).to.emit(pools, "FundingSettled").withArgs(id, true, usdc(500));

      expect(Number((await ini(id)).status)).to.equal(Status.Active);
      expect(await pools.getMilestoneAmounts(id)).to.deep.equal([usdc(200), usdc(150), usdc(150)]);
    });

    it("scaled milestones always sum to exactly what was raised", async function () {
      const { pools, create, ini, alice } = await loadFixture(fixture);
      const { id } = await create({ milestoneAmounts: [1001n * 1000n, 777n * 1000n, 333n * 1000n, 5n] });
      const raised = 1_234_567n;
      await pools.connect(alice).contribute(id, raised);
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await pools.settle(id);
      const amounts: bigint[] = await pools.getMilestoneAmounts(id);
      expect(amounts.reduce((a, b) => a + b, 0n)).to.equal(raised);
    });

    it("qualification boundary is exact: at the threshold proceeds, one unit below fails", async function () {
      const { pools, create, ini, alice, bob } = await loadFixture(fixture);
      // goal 1000 USDC, 25% => 250 USDC exactly
      const a = await create();
      await pools.connect(alice).contribute(a.id, usdc(250));
      expect(await pools.isQualified(a.id)).to.equal(true);
      const b = await create();
      await pools.connect(bob).contribute(b.id, usdc(250) - 1n);
      expect(await pools.isQualified(b.id)).to.equal(false);

      await time.increaseTo((await ini(b.id)).fundingDeadline + 1n);
      await pools.settle(a.id);
      await pools.settle(b.id);
      expect(Number((await ini(a.id)).status)).to.equal(Status.Active);
      expect(Number((await ini(b.id)).status)).to.equal(Status.Failed);
    });

    it("fails an unfunded initiative cleanly (zero raised)", async function () {
      const { pools, create, ini, alice } = await loadFixture(fixture);
      const { id } = await create();
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await expect(pools.settle(id)).to.emit(pools, "InitiativeFailed").withArgs(id, 0n);
      expect(await pools.refundableOf(id, alice.address)).to.equal(0n);
      await expect(pools.connect(alice).refund(id)).to.be.revertedWithCustomError(pools, "NothingToClaim");
    });

    it("an RFP that qualifies goes to Selecting, not Active", async function () {
      const { pools, create, ini, alice } = await loadFixture(fixture);
      const { id } = await create({ grantee: ZERO });
      await pools.connect(alice).contribute(id, usdc(300));
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await pools.settle(id);
      expect(Number((await ini(id)).status)).to.equal(Status.Selecting);
    });

    it("cannot be settled twice", async function () {
      const { pools, create, ini } = await loadFixture(fixture);
      const { id } = await create();
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await pools.settle(id);
      await expect(pools.settle(id)).to.be.revertedWithCustomError(pools, "NothingToSettle");
    });

    it("refunds everyone in full when the goal is missed", async function () {
      const { pools, token, create, ini, alice, bob } = await loadFixture(fixture);
      const { id } = await create({ qualifyBps: 10_000 });
      await pools.connect(alice).contribute(id, usdc(300));
      await pools.connect(bob).contribute(id, usdc(200));
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await pools.settle(id);
      expect(Number((await ini(id)).status)).to.equal(Status.Failed);

      const before = await token.balanceOf(alice.address);
      expect(await pools.refundableOf(id, alice.address)).to.equal(usdc(300));
      await expect(pools.connect(alice).refund(id)).to.emit(pools, "Refunded").withArgs(id, alice.address, usdc(300));
      expect((await token.balanceOf(alice.address)) - before).to.equal(usdc(300));
      await pools.connect(bob).refund(id);
      expect(await token.balanceOf(await pools.getAddress())).to.equal(0n);
      expect(await pools.liabilities(await token.getAddress())).to.equal(0n);
      await expect(pools.connect(alice).refund(id)).to.be.revertedWithCustomError(pools, "NothingToClaim");
    });
  });

  describe("RFP grantee selection", function () {
    async function selecting() {
      const f = await loadFixture(fixture);
      const { id } = await f.create({ grantee: ZERO });
      await f.fundFully(id);
      return { ...f, id };
    }

    it("lets anyone announce interest, only while selecting", async function () {
      const { pools, candidate, create } = await loadFixture(fixture);
      const { id } = await create({ grantee: ZERO });
      await expect(pools.connect(candidate).applyAsGrantee(id, "ipfs://x")).to.be.revertedWithCustomError(
        pools,
        "WrongStatus",
      );
    });

    it("emits GranteeApplied while selecting", async function () {
      const { pools, candidate, id } = await selecting();
      await expect(pools.connect(candidate).applyAsGrantee(id, "ipfs://pitch"))
        .to.emit(pools, "GranteeApplied")
        .withArgs(id, candidate.address, "ipfs://pitch");
    });

    it("selects the first candidate to reach the threshold", async function () {
      const { pools, reviewers, candidate, id, ini } = await selecting();
      await pools.connect(reviewers[0]).voteGrantee(id, candidate.address);
      await pools.connect(reviewers[1]).voteGrantee(id, candidate.address);
      expect(Number((await ini(id)).status)).to.equal(Status.Selecting);
      await expect(pools.connect(reviewers[2]).voteGrantee(id, candidate.address))
        .to.emit(pools, "GranteeSelected")
        .withArgs(id, candidate.address);
      const i = await ini(id);
      expect(Number(i.status)).to.equal(Status.Active);
      expect(i.grantee).to.equal(candidate.address);
      await expect(pools.connect(reviewers[3]).voteGrantee(id, candidate.address)).to.be.revertedWithCustomError(
        pools,
        "WrongStatus",
      );
    });

    it("rejects invalid votes", async function () {
      const { pools, reviewers, candidate, outsider, id } = await selecting();
      await expect(pools.connect(outsider).voteGrantee(id, candidate.address)).to.be.revertedWithCustomError(
        pools,
        "NotReviewer",
      );
      await expect(pools.connect(reviewers[0]).voteGrantee(id, ZERO)).to.be.revertedWithCustomError(
        pools,
        "InvalidCandidate",
      );
      await expect(pools.connect(reviewers[0]).voteGrantee(id, reviewers[1].address)).to.be.revertedWithCustomError(
        pools,
        "InvalidCandidate",
      );
      await pools.connect(reviewers[0]).voteGrantee(id, candidate.address);
      await expect(pools.connect(reviewers[0]).voteGrantee(id, outsider.address)).to.be.revertedWithCustomError(
        pools,
        "AlreadyVoted",
      );
    });

    it("window: voting works at the deadline and not after", async function () {
      const { pools, reviewers, candidate, id, ini } = await selecting();
      const deadline = (await ini(id)).selectionDeadline;
      await time.setNextBlockTimestamp(deadline);
      await pools.connect(reviewers[0]).voteGrantee(id, candidate.address);
      await time.setNextBlockTimestamp(deadline + 1n);
      await expect(pools.connect(reviewers[1]).voteGrantee(id, candidate.address)).to.be.revertedWithCustomError(
        pools,
        "ReviewWindowClosed",
      );
    });

    it("a split committee fails the initiative after the window and funders get everything back", async function () {
      const { pools, token, reviewers, candidate, outsider, alice, bob, id, ini } = await selecting();
      await pools.connect(reviewers[0]).voteGrantee(id, candidate.address);
      await pools.connect(reviewers[1]).voteGrantee(id, outsider.address);
      await pools.connect(reviewers[2]).voteGrantee(id, candidate.address);
      // candidate has 2 votes (threshold is 3), outsider has 1
      const deadline = (await ini(id)).selectionDeadline;
      await expect(pools.settle(id)).to.be.revertedWithCustomError(pools, "NothingToSettle");
      await time.setNextBlockTimestamp(deadline);
      await expect(pools.settle(id)).to.be.revertedWithCustomError(pools, "NothingToSettle");
      await time.setNextBlockTimestamp(deadline + 1n);
      await pools.settle(id);
      expect(Number((await ini(id)).status)).to.equal(Status.Failed);

      await pools.connect(alice).refund(id);
      await pools.connect(bob).refund(id);
      expect(await token.balanceOf(await pools.getAddress())).to.equal(0n);
    });
  });

  describe("milestone delivery", function () {
    it("only the grantee can submit, and only when Active and awaiting", async function () {
      const { pools, outsider, grantee, create, activeGrant } = await loadFixture(fixture);
      const early = await create();
      await expect(pools.connect(grantee).submitMilestone(early.id, "x")).to.be.revertedWithCustomError(
        pools,
        "WrongStatus",
      );
      const { id } = await activeGrant();
      await expect(pools.connect(outsider).submitMilestone(id, "x")).to.be.revertedWithCustomError(pools, "NotGrantee");
      await expect(pools.connect(grantee).submitMilestone(id, "ipfs://m0"))
        .to.emit(pools, "MilestoneSubmitted")
        .withArgs(id, 0, 1, "ipfs://m0");
      await expect(pools.connect(grantee).submitMilestone(id, "again")).to.be.revertedWithCustomError(
        pools,
        "WrongPhase",
      );
    });

    it("pays the grantee on the threshold approval, exactly, and not before", async function () {
      const { pools, token, grantee, reviewers, activeGrant, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      await pools.connect(reviewers[0]).voteMilestone(id, true);
      await pools.connect(reviewers[1]).voteMilestone(id, true);
      expect(await pools.credits(await token.getAddress(), grantee.address)).to.equal(0n);
      await expect(pools.connect(reviewers[2]).voteMilestone(id, true))
        .to.emit(pools, "MilestoneApproved")
        .withArgs(id, 0, grantee.address, usdc(400));

      const i = await ini(id);
      expect(i.currentMilestone).to.equal(1n);
      expect(i.released).to.equal(usdc(400));
      expect(Number(i.phase)).to.equal(Phase.AwaitingSubmission);
      expect(await pools.credits(await token.getAddress(), grantee.address)).to.equal(usdc(400));
      // the decision is final: a 4th reviewer cannot vote on a closed review
      await expect(pools.connect(reviewers[3]).voteMilestone(id, true)).to.be.revertedWithCustomError(
        pools,
        "WrongPhase",
      );
    });

    it("grantee withdraws what was credited, once", async function () {
      const { pools, token, grantee, activeGrant, approveWith, poolsAddr } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      await approveWith(id);
      const t = await token.getAddress();
      await expect(pools.connect(grantee).withdraw(t))
        .to.emit(pools, "Withdrawn")
        .withArgs(t, grantee.address, usdc(400));
      expect(await token.balanceOf(grantee.address)).to.equal(usdc(400));
      expect(await token.balanceOf(poolsAddr)).to.equal(usdc(600));
      expect(await pools.liabilities(t)).to.equal(usdc(600));
      await expect(pools.connect(grantee).withdraw(t)).to.be.revertedWithCustomError(pools, "NothingToClaim");
    });

    it("only reviewers vote, once per submission", async function () {
      const { pools, grantee, outsider, reviewers, activeGrant } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await expect(pools.connect(reviewers[0]).voteMilestone(id, true)).to.be.revertedWithCustomError(
        pools,
        "WrongPhase",
      );
      await pools.connect(grantee).submitMilestone(id, "m0");
      await expect(pools.connect(outsider).voteMilestone(id, true)).to.be.revertedWithCustomError(pools, "NotReviewer");
      await expect(pools.connect(grantee).voteMilestone(id, true)).to.be.revertedWithCustomError(pools, "NotReviewer");
      await pools.connect(reviewers[0]).voteMilestone(id, true);
      await expect(pools.connect(reviewers[0]).voteMilestone(id, false)).to.be.revertedWithCustomError(
        pools,
        "AlreadyVoted",
      );
    });

    it("rejection is decided as soon as approval is impossible (3 of 5 need: 3 rejections kill it)", async function () {
      const { pools, grantee, reviewers, activeGrant, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      await pools.connect(reviewers[0]).voteMilestone(id, false);
      await pools.connect(reviewers[1]).voteMilestone(id, false);
      expect(Number((await ini(id)).phase)).to.equal(Phase.UnderReview);
      await expect(pools.connect(reviewers[2]).voteMilestone(id, false))
        .to.emit(pools, "MilestoneRejected")
        .withArgs(id, 0, false);
      expect(Number((await ini(id)).phase)).to.equal(Phase.AwaitingSubmission);
      expect(Number((await ini(id)).status)).to.equal(Status.Active);
    });

    it("2 rejections + 3 approvals still approves", async function () {
      const { pools, grantee, reviewers, activeGrant, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      await pools.connect(reviewers[0]).voteMilestone(id, false);
      await pools.connect(reviewers[1]).voteMilestone(id, false);
      await pools.connect(reviewers[2]).voteMilestone(id, true);
      await pools.connect(reviewers[3]).voteMilestone(id, true);
      await pools.connect(reviewers[4]).voteMilestone(id, true);
      expect((await ini(id)).currentMilestone).to.equal(1n);
    });

    it("votes do not carry over between submissions", async function () {
      const { pools, grantee, reviewers, activeGrant } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "v1");
      for (let i = 0; i < 3; i++) await pools.connect(reviewers[i]).voteMilestone(id, false);
      await pools.connect(grantee).submitMilestone(id, "v2");
      // the same reviewers can vote again on the new submission
      await pools.connect(reviewers[0]).voteMilestone(id, true);
    });

    it("review window: vote at +14 days works, +14 days +1s does not", async function () {
      const { pools, grantee, reviewers, activeGrant, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      const started = (await ini(id)).reviewStartedAt;
      await time.setNextBlockTimestamp(started + BigInt(REVIEW_PERIOD));
      await pools.connect(reviewers[0]).voteMilestone(id, true);
      await time.setNextBlockTimestamp(started + BigInt(REVIEW_PERIOD) + 1n);
      await expect(pools.connect(reviewers[1]).voteMilestone(id, true)).to.be.revertedWithCustomError(
        pools,
        "ReviewWindowClosed",
      );
    });

    it("expireReview: not before the window ends, counts as a rejected round after", async function () {
      const { pools, grantee, activeGrant, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      const started = (await ini(id)).reviewStartedAt;
      await expect(pools.expireReview(id)).to.be.revertedWithCustomError(pools, "ReviewWindowOpen");
      await time.setNextBlockTimestamp(started + BigInt(REVIEW_PERIOD));
      await expect(pools.expireReview(id)).to.be.revertedWithCustomError(pools, "ReviewWindowOpen");
      await time.setNextBlockTimestamp(started + BigInt(REVIEW_PERIOD) + 1n);
      await expect(pools.expireReview(id)).to.emit(pools, "MilestoneRejected").withArgs(id, 0, true);
      const i = await ini(id);
      expect(Number(i.phase)).to.equal(Phase.AwaitingSubmission);
      expect(i.submissionsForCurrent).to.equal(1n);
    });

    it("three failed rounds fail the initiative and open pro-rata refunds of the unspent pool", async function () {
      const { pools, token, grantee, alice, bob, reviewers, activeGrant, approveWith, ini } =
        await loadFixture(fixture);
      const { id } = await activeGrant();
      // milestone 0 approved: 400 paid out
      await pools.connect(grantee).submitMilestone(id, "m0");
      await approveWith(id);
      // milestone 1 rejected three times
      for (let round = 0; round < 3; round++) {
        await pools.connect(grantee).submitMilestone(id, `m1-${round}`);
        for (let i = 0; i < 3; i++) await pools.connect(reviewers[i]).voteMilestone(id, false);
      }
      const i = await ini(id);
      expect(Number(i.status)).to.equal(Status.Failed);
      expect(i.refundPool).to.equal(usdc(600));
      await expect(pools.connect(grantee).submitMilestone(id, "x")).to.be.revertedWithCustomError(pools, "WrongStatus");

      // alice put in 600/1000, bob 400/1000 => 360 and 240 back
      expect(await pools.refundableOf(id, alice.address)).to.equal(usdc(360));
      expect(await pools.refundableOf(id, bob.address)).to.equal(usdc(240));
      await pools.connect(alice).refund(id);
      await pools.connect(bob).refund(id);
      // grantee keeps the 400 already credited
      expect(await pools.credits(await token.getAddress(), grantee.address)).to.equal(usdc(400));
      expect(await token.balanceOf(await pools.getAddress())).to.equal(usdc(400));
      expect(await pools.liabilities(await token.getAddress())).to.equal(usdc(400));
    });

    it("rounds reset after an approval: a milestone gets three fresh tries", async function () {
      const { pools, grantee, reviewers, activeGrant, approveWith, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      for (let round = 0; round < 2; round++) {
        await pools.connect(grantee).submitMilestone(id, "m0");
        for (let i = 0; i < 3; i++) await pools.connect(reviewers[i]).voteMilestone(id, false);
      }
      await pools.connect(grantee).submitMilestone(id, "m0 final");
      await approveWith(id);
      expect((await ini(id)).submissionsForCurrent).to.equal(0n);
      for (let round = 0; round < 2; round++) {
        await pools.connect(grantee).submitMilestone(id, "m1");
        for (let i = 0; i < 3; i++) await pools.connect(reviewers[i]).voteMilestone(id, false);
      }
      expect(Number((await ini(id)).status)).to.equal(Status.Active);
    });

    it("completes after the last approval with nothing left over", async function () {
      const { pools, token, grantee, activeGrant, approveWith, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      for (let m = 0; m < 3; m++) {
        await pools.connect(grantee).submitMilestone(id, `m${m}`);
        await approveWith(id);
      }
      const i = await ini(id);
      expect(Number(i.status)).to.equal(Status.Completed);
      expect(i.released).to.equal(usdc(1000));
      await pools.connect(grantee).withdraw(await token.getAddress());
      expect(await token.balanceOf(grantee.address)).to.equal(usdc(1000));
      expect(await token.balanceOf(await pools.getAddress())).to.equal(0n);
      expect(await pools.liabilities(await token.getAddress())).to.equal(0n);
      await expect(pools.connect(grantee).submitMilestone(id, "extra")).to.be.revertedWithCustomError(
        pools,
        "WrongStatus",
      );
    });

    it("emits InitiativeCompleted on the last approval", async function () {
      const { pools, grantee, reviewers, activeGrant } = await loadFixture(fixture);
      const { id } = await activeGrant({ milestoneAmounts: [usdc(1000)] });
      await pools.connect(grantee).submitMilestone(id, "only");
      await pools.connect(reviewers[0]).voteMilestone(id, true);
      await pools.connect(reviewers[1]).voteMilestone(id, true);
      await expect(pools.connect(reviewers[2]).voteMilestone(id, true))
        .to.emit(pools, "InitiativeCompleted")
        .withArgs(id);
    });

    it("works end to end on a partially funded, scaled plan", async function () {
      const { pools, token, grantee, create, alice, approveWith, ini } = await loadFixture(fixture);
      const { id } = await create();
      await pools.connect(alice).contribute(id, usdc(500));
      await time.increaseTo((await ini(id)).fundingDeadline + 1n);
      await pools.settle(id);
      for (let m = 0; m < 3; m++) {
        await pools.connect(grantee).submitMilestone(id, `m${m}`);
        await approveWith(id);
      }
      expect(Number((await ini(id)).status)).to.equal(Status.Completed);
      await pools.connect(grantee).withdraw(await token.getAddress());
      expect(await token.balanceOf(grantee.address)).to.equal(usdc(500));
    });
  });

  describe("cancelIdle", function () {
    it("is blocked until the grantee has been silent for 60 days, exactly", async function () {
      const { pools, activeGrant, ini } = await loadFixture(fixture);
      const { id } = await activeGrant();
      const since = (await ini(id)).lastActivity;
      await time.setNextBlockTimestamp(since + BigInt(SUBMISSION_WINDOW));
      await expect(pools.cancelIdle(id)).to.be.revertedWithCustomError(pools, "SubmissionWindowOpen");
      await time.setNextBlockTimestamp(since + BigInt(SUBMISSION_WINDOW) + 1n);
      await expect(pools.cancelIdle(id)).to.emit(pools, "InitiativeCancelled").withArgs(id, usdc(1000));
      expect(Number((await ini(id)).status)).to.equal(Status.Cancelled);
    });

    it("cannot cancel while a review is open or on a non-active initiative", async function () {
      const { pools, grantee, create, activeGrant } = await loadFixture(fixture);
      const early = await create();
      await expect(pools.cancelIdle(early.id)).to.be.revertedWithCustomError(pools, "WrongStatus");
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      await time.increase(SUBMISSION_WINDOW + DAY);
      await expect(pools.cancelIdle(id)).to.be.revertedWithCustomError(pools, "WrongPhase");
    });

    it("the idle clock restarts after each decision", async function () {
      const { pools, grantee, activeGrant, approveWith } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await time.increase(SUBMISSION_WINDOW - DAY);
      await pools.connect(grantee).submitMilestone(id, "m0");
      await approveWith(id);
      await time.increase(SUBMISSION_WINDOW - DAY);
      await expect(pools.cancelIdle(id)).to.be.revertedWithCustomError(pools, "SubmissionWindowOpen");
    });

    it("refunds only the unspent part after earlier payouts", async function () {
      const { pools, token, grantee, alice, bob, activeGrant, approveWith } = await loadFixture(fixture);
      const { id } = await activeGrant();
      await pools.connect(grantee).submitMilestone(id, "m0");
      await approveWith(id); // 400 paid out
      await time.increase(SUBMISSION_WINDOW + 1);
      await pools.cancelIdle(id);
      await pools.connect(alice).refund(id);
      await pools.connect(bob).refund(id);
      expect(await token.balanceOf(alice.address)).to.equal(usdc(1_000_000) - usdc(600) + usdc(360));
      expect(await token.balanceOf(bob.address)).to.equal(usdc(1_000_000) - usdc(400) + usdc(240));
      expect(await pools.credits(await token.getAddress(), grantee.address)).to.equal(usdc(400));
    });
  });

  describe("refund rounding", function () {
    it("never pays out more than the pool; dust stays in the contract and is accounted for", async function () {
      const { pools, reToken, alice, bob, carol, grantee, reviewers, create, approveWith } = await loadFixture(fixture);
      const t = await reToken.getAddress();
      const { id } = await create({ token: t, milestoneAmounts: [7n, 7n, 7n] });
      await pools.connect(alice).contribute(id, 7n);
      await pools.connect(bob).contribute(id, 7n);
      await pools.connect(carol).contribute(id, 7n);
      await pools.connect(grantee).submitMilestone(id, "m0");
      await approveWith(id); // 7 paid out; pool = 14
      for (let round = 0; round < 3; round++) {
        await pools.connect(grantee).submitMilestone(id, "m1");
        for (let i = 0; i < 3; i++) await pools.connect(reviewers[i]).voteMilestone(id, false);
      }
      // each of 3 funders: floor(7 * 14 / 21) = 4  => 12 of 14 paid, 2 dust
      expect(await pools.refundableOf(id, alice.address)).to.equal(4n);
      await pools.connect(alice).refund(id);
      await pools.connect(bob).refund(id);
      await pools.connect(carol).refund(id);
      await pools.connect(grantee).withdraw(t);

      const bal = await reToken.balanceOf(await pools.getAddress());
      expect(bal).to.equal(2n);
      expect(await pools.liabilities(t)).to.equal(2n); // dust is still counted as owed
    });
  });

  describe("reentrancy", function () {
    it("a token that re-enters withdraw during payout reverts the whole call", async function () {
      const { pools, reToken, grantee, create, alice, bob, approveWith } = await loadFixture(fixture);
      const t = await reToken.getAddress();
      const { id } = await create({ token: t, milestoneAmounts: [100n] });
      await pools.connect(alice).contribute(id, 60n);
      await pools.connect(bob).contribute(id, 40n);
      await pools.connect(grantee).submitMilestone(id, "m");
      await approveWith(id);
      await reToken.arm(await pools.getAddress(), 1, grantee.address, 0);
      await expect(pools.connect(grantee).withdraw(t)).to.be.revertedWithCustomError(
        pools,
        "ReentrancyGuardReentrantCall",
      );
      expect(await pools.credits(t, grantee.address)).to.equal(100n); // nothing moved
    });

    it("a token that re-enters refund during a refund reverts", async function () {
      const { pools, reToken, create, alice, bob } = await loadFixture(fixture);
      const t = await reToken.getAddress();
      const { id } = await create({ token: t, milestoneAmounts: [100n], qualifyBps: 10_000 });
      await pools.connect(alice).contribute(id, 60n);
      await pools.connect(bob).contribute(id, 20n);
      await time.increase(31 * DAY);
      await pools.settle(id);
      await reToken.arm(await pools.getAddress(), 2, alice.address, id);
      await expect(pools.connect(alice).refund(id)).to.be.revertedWithCustomError(
        pools,
        "ReentrancyGuardReentrantCall",
      );
      expect(await pools.contributions(id, alice.address)).to.equal(60n);
    });
  });

  describe("views", function () {
    it("revert for unknown ids", async function () {
      const { pools } = await loadFixture(fixture);
      await expect(pools.getInitiative(1)).to.be.revertedWithCustomError(pools, "UnknownInitiative");
      await expect(pools.getMilestoneAmounts(1)).to.be.revertedWithCustomError(pools, "UnknownInitiative");
      await expect(pools.getReviewers(1)).to.be.revertedWithCustomError(pools, "UnknownInitiative");
      await expect(pools.isQualified(1)).to.be.revertedWithCustomError(pools, "UnknownInitiative");
      await expect(pools.refundableOf(1, ZERO)).to.be.revertedWithCustomError(pools, "UnknownInitiative");
    });

    it("refundableOf is zero for anything not failed or cancelled", async function () {
      const { pools, alice, activeGrant } = await loadFixture(fixture);
      const { id } = await activeGrant();
      expect(await pools.refundableOf(id, alice.address)).to.equal(0n);
    });
  });
});
