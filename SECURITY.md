# Security policy

Milestone Pools holds funds in a smart contract, so security reports are welcome and taken seriously.

## Status

The contract has **not yet had an independent audit**. It is live on the Sepolia test network only. Until an audit is complete, any deployment with real funds is capped (see [docs/AUDIT-PACK.md](docs/AUDIT-PACK.md)) and should be treated as a beta.

## Reporting a vulnerability

Please report privately and do not open a public issue.

- Use GitHub's private reporting: the **Security** tab of this repository, then **Report a vulnerability**.
- Or email **kialofrances@gmail.com** with the subject "Milestone Pools security".

Include what you found, how to reproduce it (a failing test is ideal), the affected network and contract address, and your suggested fix if you have one. You will get a reply within 7 days. Please give me a reasonable time to fix the issue before sharing it publicly.

There is no bug bounty at the moment. Credit in the fix notes is offered to anyone who wants it.

## Scope

In scope:

- `packages/hardhat/contracts/MilestonePools.sol` and its deployments.

Out of scope:

- The test token (`MockERC20`) and the Sepolia demo data.
- The web app in `packages/nextjs`, unless the issue could cause a user to lose funds (for example a wrong address or amount shown). Report those too.
- Attacks that need a compromised committee majority, which the design documents as a known trust assumption.
- Issues in USDC, wallets or the networks themselves.

## Design limits that reduce risk

- No owner, admin, pause or upgrade function. The token allowlist and the limits are fixed at deployment.
- Per-token cap on any single initiative's goal and on the total the contract holds at once.
- Pull payments only: grantees withdraw approved milestones and backers claim refunds.
