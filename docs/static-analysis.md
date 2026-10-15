# Static analysis

Slither 0.11 was run against `packages/hardhat/contracts/MilestonePools.sol` (OpenZeppelin dependencies excluded):

    slither packages/hardhat/contracts/MilestonePools.sol --exclude-dependencies --exclude pragma,solc-version

No high or medium findings. Every informational finding was reviewed:

| Detector | Where | Verdict |
| --- | --- | --- |
| `timestamp` | deadline checks in `contribute`, `settle`, `voteGrantee`, `voteMilestone`, `expireReview`, `cancelIdle` | Intended. All windows are measured in days (1 to 90). A block producer can shift `block.timestamp` by seconds, which cannot change the outcome of a day-scale window in any way that matters. Boundaries are tested to the exact second. |
| `incorrect-equality` | `_approve`: `currentMilestone == milestoneCount` | A counter compared against an array length, not a balance or a value an attacker can influence. Intended. |
| `uninitialized-local` | `goal` in `createInitiative`, `assigned` in `_activate` | Both are accumulators that must start at zero. Intended. |
| `cyclomatic-complexity` | `createInitiative` | Validation branches only, each covered by a test. Kept in one function so validation and storage stay readable together. |
| `assembly` | OpenZeppelin `SafeERC20`, `StorageSlot` | Dependency code, not ours. |

Not reported, and covered by tests: reentrancy (all token-moving functions use `nonReentrant` and update state before transferring; see the `reentrancy` tests with a hostile token), fee-on-transfer deposits (rejected), and solvency (`balance == liabilities` after every step of 25 randomized runs).

This is an automated pass plus tests written by the author. It is not an audit.