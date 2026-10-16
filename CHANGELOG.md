# Changelog

All notable changes to this project are listed here.

## [0.1.0] - 2026-10-16

First public release. Testnet only.

### Contract

- Pooled, milestone-gated funding with a fixed review committee per initiative.
- Funding deadline with a qualification threshold: initiatives that miss the goal but pass the threshold start with a scaled-down plan, others fail and refund.
- Open calls: the committee can choose the grantee after funding.
- Milestone review with approve and reject votes, a 14-day review window, silence counted as a rejected round, and at most three rounds per milestone.
- Cancellation after 60 days without a submission.
- Pro rata refunds of the unspent pool on failure or cancellation.
- Pull payments, a global liabilities counter, reentrancy protection, and rejection of fee-on-transfer tokens.
- Deployed to Sepolia and verified on Etherscan.

### App

- Explore with search, filters, saved items, card and table views, CSV export, and a compare view for up to three initiatives.
- Initiative page with milestone timeline, committee and reviewer track records, a "Before you contribute" fact panel, a payout and refund simulator, calendar reminders, share cards and an activity log.
- Create flow with milestones, committee, funding period, minimum to proceed, links and questions.
- My activity, wallet profiles, platform stats, leaderboards, live activity feed and notifications.
- FAQ, Terms and Risks, and Support pages.
- Dark theme, responsive layout down to phone width, keyboard and screen-reader labels checked with an automated accessibility scan.

### Testing

- 51 unit tests and 25 randomized invariant runs.
- Static analysis with Slither: remaining findings are informational (timestamp comparisons, which are by design on day-scale windows, plus style notes).
