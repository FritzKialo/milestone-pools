# Milestone Pools

Pooled funding that pays out milestone by milestone. Backers put USDC into a shared pool for an initiative. If enough is raised, the money is released to the person doing the work only as a fixed review committee approves each milestone. If the goal is missed or the work stalls, whatever has not been paid out goes back to the backers in proportion to what each of them put in.

There is no owner, no admin key, no pause switch and no upgrade path. Nobody, including the deployer, can move funds except through the rules below.

- Live demo: [pools.frenkia.com](https://pools.frenkia.com) (Sepolia test network; connect a wallet set to Sepolia)
- Live contract on Sepolia: [`0xb09af45694a3455998380033bb75703cdc087e88`](https://sepolia.etherscan.io/address/0xb09af45694a3455998380033bb75703cdc087e88#code) (source verified)
- Test USDC on Sepolia: [`0xa24e43dd2796d2baced76504baaab1107f10c6e4`](https://sepolia.etherscan.io/address/0xa24e43dd2796d2baced76504baaab1107f10c6e4#code) (free to mint, no value)

> **Status: unaudited, testnet only.** This is a portfolio and learning project. Do not put real funds into it. See [the threat model](docs/THREAT_MODEL.md) for what it protects against and what it cannot.

## How it works

1. **Create.** Someone proposes an initiative: a funding goal split into 1 to 10 milestones, a funding period of 1 to 90 days, a minimum share of the goal needed to go ahead, a grantee (or an open call, see below), and a review committee of 3 to 9 wallets with an approval threshold. The committee is fixed at creation and can never be changed.
2. **Fund.** Anyone can contribute test USDC until the deadline. If the goal is reached, the initiative starts immediately.
3. **Settle.** If the deadline passes below the goal but above the minimum, anyone can start it with every milestone scaled down in proportion to what was raised. Below the minimum, it fails and everyone can claim a full refund.
4. **Deliver.** The grantee submits evidence (a link) for the current milestone. The committee has 14 days to vote. When the approvals reach the threshold, the milestone's amount is credited to the grantee, who withdraws it.
5. **Reject or stall.** If too many reviewers reject, or the committee stays silent for 14 days, that round is used up. A milestone gets at most 3 rounds, after which the initiative fails. If the grantee submits nothing for 60 days, anyone can cancel it.
6. **Refund.** On failure or cancellation, each backer can claim `contribution × unspent pool ÷ total raised`. Money already paid out for approved milestones stays paid.

### Open calls

A proposer can leave the grantee empty. Once the goal is met, the committee has 30 days to vote for a grantee. Candidates can announce interest on-chain, and the first candidate to reach the approval threshold is selected. If nobody is chosen in time, everyone is refunded.

## What the contract guarantees, and what it does not

It enforces who can move money and when. Committee members can release a milestone to the named grantee or let funds return to backers. They can never send funds to themselves or a third party.

It cannot judge whether the work is good. A committee majority that works with the grantee can approve work that was not done. That is why the app shows the committee, each reviewer's track record, and a plain list of facts before anyone contributes. Read the committee before you contribute.

Other properties worth knowing:

- Payouts are pull-based: approved milestones credit the grantee, who withdraws.
- A global counter tracks everything the contract owes per token, and a randomized test checks after every step that the contract's balance covers it.
- Fee-on-transfer tokens are rejected, and the token allowlist is fixed at deployment.
- Refund shares round down, so a few units of rounding dust can remain in the contract. They stay accounted for.

## Fixed parameters

| Rule | Value |
|---|---|
| Milestones per initiative | 1 to 10 |
| Review committee | 3 to 9 wallets, strict majority threshold |
| Funding period | 1 to 90 days |
| Minimum share to go ahead | at least 10% of the goal |
| Review window | 14 days |
| Submission window before cancellation | 60 days |
| Grantee selection (open calls) | 30 days |
| Review rounds per milestone | 3 |
| Protocol fee | none |
| Minimum contribution | 1 USDC |

## The app

A Next.js front end reads everything straight from the contract. There is no backend and no database.

- **Explore:** search, filters, saved items, card and table views, CSV export, and a side-by-side compare view for up to three initiatives.
- **Initiative page:** milestone timeline, committee with each reviewer's voting record, a "Before you contribute" panel of facts read from the contract, a payout and refund simulator, calendar reminders, share cards, and the full activity log.
- **My activity and profiles:** what a wallet has backed, created, reviewed and can withdraw or claim.
- **Stats and leaderboards:** totals, funding over time, top backers and most active reviewers, plus a live activity feed.
- **Help:** FAQ, Terms and Risks, and a Support page.

## Run it locally

You need Node 20.18.3 or newer, Yarn, and Git.

```bash
git clone https://github.com/FritzKialo/milestone-pools.git
cd milestone-pools
yarn install
```

In three terminals:

```bash
yarn chain     # local test chain
yarn deploy    # deploys test USDC and MilestonePools to it
yarn start     # app at http://localhost:3000
```

On the local chain the app offers a built-in burner wallet and a faucet, so no browser wallet is needed.

### Tests

```bash
yarn test
```

76 tests run: 51 unit tests (creation, contributions, settling, open calls, milestone delivery, cancellation, refund rounding, reentrancy, views) and 25 randomized invariant runs that check balance and accounting after every step.

### Other checks

```bash
yarn next:check-types
yarn next:lint
yarn format
```

## Project layout

```
packages/
  hardhat/   contracts, deploy scripts and tests
  nextjs/    the web app (app router, components, hooks, lib)
docs/        threat model
```

The contract is `packages/hardhat/contracts/MilestonePools.sol`. The deploy script also deploys a mintable test USDC, which is for test networks only. A real deployment would pass real token addresses to the constructor.

## Documentation

- [Threat model](docs/THREAT_MODEL.md)
- [Changelog](CHANGELOG.md)
- [Security and support](SECURITY.md)

## Built with

Solidity, Hardhat, OpenZeppelin, Next.js, React, wagmi, viem, RainbowKit, Tailwind and daisyUI, on top of the Scaffold-ETH 2 starter.

## License

MIT. The starter code is MIT licensed by BuidlGuidl; see [LICENCE](LICENCE).
