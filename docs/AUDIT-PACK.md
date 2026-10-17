# Audit pack

Everything an auditor or grant reviewer needs to scope and review Milestone Pools in one place. The contract has **not yet been independently audited**.

## 1. What is in scope

| Item | Detail |
| --- | --- |
| Contract | `packages/hardhat/contracts/MilestonePools.sol`, about 576 lines |
| Compiler | Solidity 0.8.30, pinned |
| Dependencies | OpenZeppelin Contracts 5.x: `SafeERC20`, `ReentrancyGuard` |
| Out of scope | `MockERC20` (test token), the web app, deployment scripts (reviewed on request) |

## 2. Deployments

| Network | MilestonePools | Token | Status |
| --- | --- | --- | --- |
| Sepolia (11155111) | `0xb09af45694a3455998380033bb75703cdc087e88` | MockUSDC `0xa24e43dd2796d2baced76504baaab1107f10c6e4` | Live, source verified on Etherscan |
| Base (8453) | not deployed | Circle USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Planned |
| Arbitrum One (42161) | not deployed | Circle USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Planned |
| OP Mainnet (10) | not deployed | Circle USDC `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | Planned |

Planned mainnet deployments use beta limits fixed in the constructor: 1 USDC minimum contribution, 500 USDC goal limit per initiative, 5,000 USDC total held.

## 3. What the contract does

Pooled funding for a project, paid out by milestone. Backers contribute an ERC-20 (USDC) towards a goal. A fixed committee of 3 to 9 reviewers approves each milestone by majority. Unspent funds go back to backers pro rata if the project fails or stalls.

Roles:

| Role | Can do |
| --- | --- |
| Proposer | Create an initiative. No special powers afterwards. |
| Backer | `contribute`, `refund` |
| Grantee | `submitMilestone`, `withdraw` |
| Reviewer | `voteMilestone`, `voteGrantee` (open calls) |
| Anyone | `settle`, `expireReview`, `cancelIdle`, `applyAsGrantee` (informational) |

There is no owner, admin, pause or upgrade function.

## 4. State machine

| From | Trigger | To |
| --- | --- | --- |
| Funding | A contribution fills the goal exactly | Active (named grantee) or Selecting (open call) |
| Funding | Funding deadline passes with raised at least `qualifyBps` of the goal (`settle`) | Active (named grantee) or Selecting (open call) |
| Funding | Funding deadline passes below the threshold (`settle`) | Failed |
| Selecting | A candidate reaches the approval threshold of committee votes | Active |
| Selecting | 30 days pass without a grantee (`settle`) | Failed |
| Active | Milestone approved, more milestones remain | Active (next milestone) |
| Active | Final milestone approved | Completed |
| Active | A milestone is rejected 3 times | Failed |
| Active | 60 days with no submission (`cancelIdle`) | Cancelled |

Review round: the grantee submits, reviewers have 14 days. Enough approvals pays the milestone. Enough rejections, or silence past 14 days (`expireReview`), uses up one of three rounds.

If the goal is not fully met but the threshold is, milestone amounts are scaled down proportionally and the last milestone absorbs rounding.

## 5. Parameters

| Constant | Value |
| --- | --- |
| Reviewers per initiative | 3 to 9; threshold is a strict majority |
| Milestones per initiative | 1 to 10 |
| Funding duration | 1 to 90 days |
| Minimum qualifying share | at least 10% of goal |
| Review period | 14 days |
| Submission window (idle cancel) | 60 days |
| Grantee selection period | 30 days |
| Submission rounds per milestone | 3 |
| Allowlisted tokens | up to 20, fixed at deployment |
| Per-token limits | minimum contribution, goal limit, total cap: fixed at deployment |

## 6. Accounting invariants

The design keeps these true after every call:

1. **Solvency:** the contract's token balance is always at least `liabilities[token]`, the sum of pooled funds, withdrawable credits and unclaimed refunds.
2. **Conservation:** per initiative, what was raised is always accounted for as released to the grantee, held for unspent milestones, or placed in the refund pool.
3. **Caps:** a contribution that would take `liabilities` above `totalCap[token]` reverts (`CapReached`), and an initiative whose goal exceeds `maxGoal[token]` cannot be created (`GoalTooLarge`).
4. **Reviewers cannot redirect funds:** they can only release a milestone to the grantee or let funds return to backers.
5. **Refund rounding:** pro-rata refunds are computed per account as `contribution * refundPool / raised`, rounded down, and never exceed the refund pool. A few wei of rounding dust stay in the contract and remain counted in `liabilities`.
6. **No zero milestones:** creation rejects milestone amounts that could round to zero under the smallest qualifying raise.
7. **Funding bounds:** a contribution cannot exceed the remaining goal, and the minimum contribution does not apply to the one that exactly fills it, so a gap smaller than the minimum can never block an initiative.

These are exercised by the randomized invariant tests described below.

## 7. Trust assumptions and known risks

- **Committee collusion.** A committee majority that colludes with the grantee can release funds for work that was not done. This is inherent to human-judged milestones and is documented to users. Backers should read the committee before contributing.
- **Committee inactivity.** Silence counts as a rejection, so a passive committee leads to a refund, not to a payout.
- **Token behaviour.** Intended for USDC (6 decimals). Fee-on-transfer tokens are rejected at contribution (`FeeOnTransferToken`). Rebasing tokens are unsupported. USDC's issuer can blocklist addresses, so a blocklisted grantee or backer may be unable to withdraw or refund. This is disclosed in the terms of use.
- **Immutability.** No upgrade path. A bug means deploying a new version, and funds in the old one stay governed by the old rules. Per-token caps bound the exposure.
- **Timestamps.** Deadlines and windows are measured in days, so validator timestamp drift of seconds has no practical effect.
- **Rounding dust.** Rounding in refunds and in scaled-down milestones can leave a few wei in the contract. It stays counted as a liability and is not recoverable by anyone.
- **Permissionless keepers.** `settle`, `expireReview` and `cancelIdle` can be called by anyone.
- **Open call applications.** `applyAsGrantee` only emits an event.

## 8. Testing

- **81 automated tests** (`packages/hardhat/test/`), covering deployment, creation, contribution, beta limits, settlement, open-call selection, milestone delivery, idle cancellation, refund rounding, reentrancy and views.
- **Randomized invariant tests** (`MilestonePoolsInvariants.ts`) run seeded random sequences of actions and check solvency, conservation and exact accounting after every step.
- **Static analysis:** Slither (100 detectors, Solidity 0.8.30) reported 25 results in five categories, none high or medium. Reviewed as follows: strict equality on the final-milestone check is intended; two never-initialised locals are accumulators that start at zero; timestamp comparisons use windows of days; assembly findings are inside OpenZeppelin; one cyclomatic-complexity note on `createInitiative`.

Reproduce:

```bash
yarn install
cd packages/hardhat
yarn test
```

## 9. Where I would like the auditor to focus

1. The `liabilities` accounting across contribute, settle, approve, refund and withdraw, including rounding on scale-down and pro-rata refunds.
2. The voting and timing rules in `voteMilestone`, `expireReview` and the round counter, including edge cases at exact deadlines.
3. The open-call path: `voteGrantee`, selection deadline and what happens to funds if no grantee is chosen.
4. Interaction with USDC: blocklisting, return values, reentrancy via token hooks.
5. The beta limits (`maxGoal`, `totalCap`) and whether they can be bypassed.
6. Anything in the deployment and verification process that could cause a wrong token or limit to be set.

## 10. Contact

Francis Kialo Mwendwa, kialofrances@gmail.com. See [SECURITY.md](../SECURITY.md) for reporting.
