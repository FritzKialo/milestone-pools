# Security policy

Milestone Pools holds funds in a smart contract, so security reports are welcome and taken seriously.

## Status

The contract has **not yet had an independent audit**. It runs in two places:

- **Base:** a capped beta holding real USDC, at [`0x50ad6c7e2f6c1598ccd35a3e0194abd71a470fab`](https://basescan.org/address/0x50ad6c7e2f6c1598ccd35a3e0194abd71a470fab#code). Each initiative can raise at most 500 USDC and the contract can hold at most 5,000 USDC in total. These caps are fixed at deployment and cannot be raised (see [docs/AUDIT-PACK.md](docs/AUDIT-PACK.md)).
- **Sepolia:** a public demo with a free test token, at [`0xb09af45694a3455998380033bb75703cdc087e88`](https://sepolia.etherscan.io/address/0xb09af45694a3455998380033bb75703cdc087e88#code).

Treat the Base deployment as a beta and only contribute what you can afford to lose.

## Reporting a vulnerability

Please report privately and do not open a public issue.

- Use GitHub's private reporting: the **Security** tab of this repository, then **Report a vulnerability**.
- Or email **kialofrances@gmail.com** with the subject "Milestone Pools security".

Include what you found, how to reproduce it (a failing test is ideal), the affected network and contract address, and your suggested fix if you have one. You will get a reply within 7 days. Please give me a reasonable time to fix the issue before sharing it publicly.

There is no bug bounty at the moment. Credit in the fix notes is offered to anyone who wants it.

## Scope

In scope:

- `packages/hardhat/contracts/MilestonePools.sol` and its deployments, above all the Base contract, which holds real funds.
- The deploy plan in `packages/hardhat/rocketh/plan.ts`, which decides the token and caps for each network.

Out of scope:

- The test token (`MockERC20`) and the Sepolia demo data.
- The web app in `packages/nextjs`, unless the issue could cause a user to lose funds (for example a wrong address or amount shown). Report those too.
- Attacks that need a compromised committee majority, which the design documents as a known trust assumption.
- Issues in USDC, wallets or the networks themselves.

## Design limits that reduce risk

- No owner, admin, pause or upgrade function. The token allowlist and the limits are fixed at deployment.
- Per-token cap on any single initiative's goal and on the total the contract holds at once: 500 USDC and 5,000 USDC on Base.
- The deploy script identifies the network by chain ID and refuses any chain without a configured token, so a real network cannot be given a test token by mistake.
- Pull payments only: grantees withdraw approved milestones and backers claim refunds.
