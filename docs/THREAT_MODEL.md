# Threat model

Milestone Pools holds other people's tokens and releases them under rules. This document says what the design protects against, what it does not, and what was done to check it. It is unaudited.

It is deployed on Base as a capped beta holding real USDC (at most 500 USDC per initiative and 5,000 USDC in total), and on Sepolia as a demo with a free test token.

## What is being protected

- **Pooled funds:** tokens contributed to an initiative and not yet paid out.
- **Credited payouts:** approved milestone amounts waiting for the grantee to withdraw.
- **Refund rights:** each backer's claim on the unspent pool after a failure or cancellation.

## Who can do what

| Actor | Can | Cannot |
|---|---|---|
| Anyone | Create an initiative, contribute, settle a lapsed state, close a lapsed review, cancel an idle initiative, claim their own refund | Move anyone else's funds |
| Backer | Claim a pro rata refund after failure or cancellation | Withdraw while the initiative is running |
| Grantee | Submit milestones, withdraw credited payouts | Approve their own milestones (grantees cannot be on the committee) |
| Committee member | Approve or reject the current milestone, vote for a grantee in an open call | Send funds anywhere except the grantee or back to backers; change the committee |
| Deployer | Nothing after deployment | There is no owner, admin, pause or upgrade |

## Trust assumptions

1. **The committee is honest enough.** A majority that colludes with the grantee can release money for work that was not done. The contract cannot prevent this. It limits the damage: funds are released one milestone at a time, so a backer's exposure at any point is the milestones already approved.
2. **The token behaves.** Only tokens allowlisted at deployment can be used, and fee-on-transfer tokens are rejected on every contribution. A token that can freeze or blacklist addresses could still lock funds. The Base deployment uses Circle's USDC, whose issuer can freeze addresses, including the contract itself; if that happened, funds held in the contract could not move until it was lifted. The Sepolia test token has no such feature.
3. **The grantee address is correct and controlled.** Payouts are credited to the address given at creation. If that key is lost, the credited funds cannot be recovered.
4. **The chain's clock is roughly right.** Deadlines are days long, so a few seconds of block timestamp variation does not matter.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Reentrancy through a malicious token during payout or refund | State is updated before transfers, `nonReentrant` on contribute, withdraw and refund, tests with a token that re-enters | Low |
| Contract owing more than it holds | Per-token liabilities counter; a randomized test checks balance covers liabilities after every step | Low |
| Fee-on-transfer token creating a shortfall | Balance is measured before and after each transfer and the call reverts on a mismatch | Low |
| Admin or deployer abuse | No privileged roles exist | None by design |
| Committee goes silent | Silence for 14 days counts as a rejected round; after three rounds the initiative fails and backers are refunded | Delays of up to several weeks |
| Grantee disappears | After 60 days without a submission anyone can cancel; unspent funds are refunded | Delay of up to 60 days |
| Funder over-contributes at the last moment | Contributions above the remaining amount revert | Low |
| Rounding creating unbacked refunds | Shares round down; a few units of dust stay in the contract and remain counted as owed | Negligible |
| Votes replayed across rounds | Each vote is scoped to the submission round | Low |
| Spam or misleading initiatives | Anyone can create one. The app shows facts (committee size, creator on committee, first milestone share, minimum, backer concentration) but does not rate quality | Medium; backers must judge |
| Committee made of the proposer's own wallets | The app flags when the creator is on the committee and shows reviewer track records, but cannot see who controls a wallet | Medium |
| Malicious metadata or links in an initiative | The app limits field lengths, accepts only https and ipfs links, and treats all text as untrusted | Low; a link can still lead somewhere unsafe |
| Phishing or a fake copy of the site | Contract addresses are shown in the footer and linked to the block explorer (BaseScan or Etherscan), where verified source is shown | Depends on users |
| An undiscovered bug in the unaudited contract | Per-token caps fixed at deployment limit the most that can be at risk: 500 USDC per initiative and 5,000 USDC in total on Base | Medium until audited; losses are bounded by the caps |
| A real network deployed with the test token or wrong limits | The deploy script reads the chain ID from the node, uses Circle's USDC and beta caps on Base, Arbitrum One and OP Mainnet, uses the test token only on known test networks, and refuses any other chain | Low |

## Not covered

- Judging whether delivered work is good.
- Identity: the contract knows addresses, not people.
- Recovery of funds sent to a wrong address or credited to a lost key.
- Protection if the underlying token itself is compromised.
- Legal, tax or regulatory questions. See the Terms and Risks page in the app.
- Any claim of safety at larger scale. It has not been audited.

## How it was checked

- 51 unit tests covering creation, contribution limits, settling, open calls, milestone voting, expiry, cancellation, refund rounding, reentrancy and views.
- 25 randomized runs that perform random sequences of actions across many initiatives and check, after every step, that the contract balance covers what it owes and that accounting is exact. The run fails if any action type (creation, contribution, settling, voting, submission, expiry, cancellation, refund, withdrawal, and the completed, failed and cancelled end states) was never exercised.
- Slither static analysis. The remaining findings are informational: timestamp comparisons on day-scale windows, a strict equality used to detect the final milestone, uninitialized loop locals that default to zero, assembly inside the OpenZeppelin library, and a complexity note on the creation function.
- Deployed to Sepolia with verified source.
- Rehearsed on Base Sepolia, then deployed to Base with verified source. One full cycle was run there with real USDC: an initiative was created, funded, its milestone submitted, approved by the committee and withdrawn by the grantee.

Still to do before raising the caps: an independent audit, a bug bounty, and a longer period of capped use on Base.
