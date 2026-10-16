// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MilestonePools
/// @notice Pooled, milestone-gated funding for public-goods work, with a fixed review committee
///         per initiative. Funders pool a single ERC-20 towards a goal. If enough is raised, a
///         grantee is paid milestone by milestone when a committee majority approves each one.
///         If not, or if the work stalls, unspent funds go back to the funders pro rata.
///
/// @dev Trust model: trust-minimised, human-judged. The contract enforces who can move funds
///      and when. It cannot judge whether work is good: that is the committee's job. A committee
///      majority that colludes with the grantee can release funds for work that was not done.
///      Funders should read the committee before contributing.
///
///      Design rules:
///        - No owner, no admin, no pause, no upgrade. The token allowlist and the limits below are
///          fixed at deployment. Raising a limit means deploying a new version.
///        - Per-token safety limits: a cap on any single initiative's goal and a cap on the total
///          this contract may hold at once. They bound how much a bug or a bad actor can put at risk.
///        - Pull payments only. Approved milestones credit the grantee; the grantee withdraws.
///        - Per-initiative accounting plus a global per-token `liabilities` counter, so the
///          token balance of this contract is always >= what it owes (see {liabilities}).
///        - Committee members can only (a) release a milestone to the grantee or (b) let funds
///          return to funders. They can never redirect funds to themselves or a third party.
contract MilestonePools is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/

    enum Status {
        Funding, // accepting contributions until fundingDeadline
        Selecting, // RFP only: goal met, committee choosing a grantee
        Active, // grantee delivering milestones
        Completed, // every milestone approved
        Failed, // goal missed, no grantee chosen, or milestones rejected too often
        Cancelled // grantee went silent
    }

    enum Phase {
        AwaitingSubmission,
        UnderReview
    }

    struct CreateParams {
        address token; // must be on the allowlist
        address grantee; // address(0) makes this an RFP: the committee picks the grantee later
        uint256[] milestoneAmounts; // sums to the funding goal, 1..MAX_MILESTONES entries
        uint16 qualifyBps; // share of the goal (in basis points) needed to proceed at the deadline
        uint64 fundingDuration; // seconds, MIN_FUNDING_DURATION..MAX_FUNDING_DURATION
        address[] reviewers; // MIN_REVIEWERS..MAX_REVIEWERS distinct addresses, fixed forever
        uint8 threshold; // approvals needed, must be a strict majority of reviewers
        uint8 category; // free-form label for front ends, not used by the contract
        string metadataURI; // pointer to the proposal text (IPFS, https, ...); emitted only
    }

    struct Initiative {
        address token;
        address grantee;
        address proposer;
        uint256 goal;
        uint256 raised;
        uint256 released; // total credited to the grantee so far
        uint256 refundPool; // unspent funds shared pro rata once Failed or Cancelled
        uint64 fundingDeadline;
        uint64 selectionDeadline;
        uint64 lastActivity;
        uint64 reviewStartedAt;
        uint32 backers;
        uint16 qualifyBps;
        uint16 reviewNo; // counts every submission, used to scope votes
        uint8 reviewerCount;
        uint8 threshold;
        uint8 currentMilestone;
        uint8 submissionsForCurrent;
        uint8 approvals;
        uint8 rejections;
        Status status;
        Phase phase;
    }

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint8 public constant MIN_REVIEWERS = 3;
    uint8 public constant MAX_REVIEWERS = 9;
    uint8 public constant MAX_MILESTONES = 10;
    uint8 public constant MAX_ROUNDS = 3; // submissions allowed per milestone
    uint16 public constant MIN_QUALIFY_BPS = 1_000; // 10%
    uint16 public constant BPS = 10_000;
    uint64 public constant MIN_FUNDING_DURATION = 1 days;
    uint64 public constant MAX_FUNDING_DURATION = 90 days;
    uint64 public constant REVIEW_PERIOD = 14 days;
    uint64 public constant SUBMISSION_WINDOW = 60 days;
    uint64 public constant SELECTION_PERIOD = 30 days;
    uint256 public constant MAX_TOKENS = 20;

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Smallest contribution per token. Zero means the token is not allowed.
    mapping(address token => uint256 amount) public minContribution;

    /// @notice Largest funding goal a single initiative may set in `token`.
    mapping(address token => uint256 amount) public maxGoal;

    /// @notice Most this contract may owe in `token` at any one time (see {liabilities}).
    mapping(address token => uint256 amount) public totalCap;

    /// @notice Everything this contract owes in `token`: pooled funds, credits, unclaimed refunds.
    ///         The token balance of the contract is always >= this number.
    mapping(address token => uint256 amount) public liabilities;

    /// @notice Withdrawable balance of `account` in `token` (milestone payouts).
    mapping(address token => mapping(address account => uint256 amount)) public credits;

    uint256 public initiativeCount;

    mapping(uint256 id => Initiative) private _initiatives;
    mapping(uint256 id => uint256[]) private _milestoneAmounts;
    mapping(uint256 id => address[]) private _reviewers;
    mapping(uint256 id => mapping(address account => bool)) public isReviewer;
    mapping(uint256 id => mapping(address funder => uint256 amount)) public contributions;
    mapping(uint256 id => mapping(uint16 reviewNo => mapping(address reviewer => bool))) public hasVoted;
    mapping(uint256 id => mapping(address candidate => uint8 votes)) public candidateVotes;
    mapping(uint256 id => mapping(address reviewer => address candidate)) public reviewerChoice;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event InitiativeCreated(
        uint256 indexed id,
        address indexed proposer,
        address indexed token,
        address grantee,
        uint256 goal,
        uint16 qualifyBps,
        uint64 fundingDeadline,
        uint8 threshold,
        uint8 category
    );
    event InitiativeDetails(uint256 indexed id, uint256[] milestoneAmounts, address[] reviewers, string metadataURI);
    event Contributed(uint256 indexed id, address indexed funder, uint256 amount, uint256 raised);
    event FundingSettled(uint256 indexed id, bool proceeded, uint256 raised);
    event GranteeApplied(uint256 indexed id, address indexed candidate, string pitchURI);
    event GranteeVote(uint256 indexed id, address indexed reviewer, address indexed candidate);
    event GranteeSelected(uint256 indexed id, address indexed grantee);
    event MilestoneSubmitted(uint256 indexed id, uint8 indexed milestone, uint16 reviewNo, string evidenceURI);
    event ReviewVote(uint256 indexed id, uint8 indexed milestone, address indexed reviewer, bool approve);
    event MilestoneApproved(uint256 indexed id, uint8 indexed milestone, address indexed grantee, uint256 amount);
    event MilestoneRejected(uint256 indexed id, uint8 indexed milestone, bool lapsed);
    event InitiativeCompleted(uint256 indexed id);
    event InitiativeFailed(uint256 indexed id, uint256 refundPool);
    event InitiativeCancelled(uint256 indexed id, uint256 refundPool);
    event Refunded(uint256 indexed id, address indexed funder, uint256 amount);
    event Withdrawn(address indexed token, address indexed account, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NoTokens();
    error TooManyTokens();
    error LengthMismatch();
    error InvalidToken();
    error DuplicateToken();
    error InvalidMinimum();
    error InvalidLimit();
    error GoalTooLarge();
    error CapReached();
    error TokenNotAllowed();
    error InvalidMilestones();
    error InvalidQualifyBps();
    error InvalidDuration();
    error InvalidReviewers();
    error InvalidThreshold();
    error InvalidGrantee();
    error UnknownInitiative();
    error WrongStatus();
    error WrongPhase();
    error FundingClosed();
    error BelowMinimum();
    error ExceedsGoal();
    error FeeOnTransferToken();
    error NothingToSettle();
    error NotGrantee();
    error NotReviewer();
    error AlreadyVoted();
    error ReviewWindowClosed();
    error ReviewWindowOpen();
    error SubmissionWindowOpen();
    error InvalidCandidate();
    error NothingToClaim();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param tokens ERC-20 tokens initiatives may raise in. Fixed forever.
    /// @param minimums Smallest accepted contribution for each token, in token units.
    /// @param maxGoals Largest funding goal one initiative may set for each token.
    /// @param totalCaps Most the contract may hold at once for each token. At least the matching goal limit.
    constructor(
        address[] memory tokens,
        uint256[] memory minimums,
        uint256[] memory maxGoals,
        uint256[] memory totalCaps
    ) {
        uint256 n = tokens.length;
        if (n == 0) revert NoTokens();
        if (n > MAX_TOKENS) revert TooManyTokens();
        if (n != minimums.length || n != maxGoals.length || n != totalCaps.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            address t = tokens[i];
            if (t == address(0) || t.code.length == 0) revert InvalidToken();
            if (minimums[i] == 0) revert InvalidMinimum();
            if (maxGoals[i] < minimums[i] || totalCaps[i] < maxGoals[i]) revert InvalidLimit();
            if (minContribution[t] != 0) revert DuplicateToken();
            minContribution[t] = minimums[i];
            maxGoal[t] = maxGoals[i];
            totalCap[t] = totalCaps[i];
        }
    }

    /*//////////////////////////////////////////////////////////////
                               CREATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Open a new initiative. The proposer gets no special powers afterwards.
    /// @return id The new initiative id (starting at 1).
    function createInitiative(CreateParams calldata p) external returns (uint256 id) {
        if (minContribution[p.token] == 0) revert TokenNotAllowed();
        if (p.qualifyBps < MIN_QUALIFY_BPS || p.qualifyBps > BPS) revert InvalidQualifyBps();
        if (p.fundingDuration < MIN_FUNDING_DURATION || p.fundingDuration > MAX_FUNDING_DURATION) {
            revert InvalidDuration();
        }

        uint256 mCount = p.milestoneAmounts.length;
        if (mCount == 0 || mCount > MAX_MILESTONES) revert InvalidMilestones();
        uint256 goal;
        for (uint256 i; i < mCount; ++i) {
            uint256 a = p.milestoneAmounts[i];
            // Each milestone must be large enough to survive the worst-case scale-down (the smallest
            // qualifying raise) with at least one unit left, so no milestone can round to zero.
            if (a == 0 || a * p.qualifyBps < BPS) revert InvalidMilestones();
            goal += a;
        }
        if (goal > maxGoal[p.token]) revert GoalTooLarge();

        uint256 rCount = p.reviewers.length;
        if (rCount < MIN_REVIEWERS || rCount > MAX_REVIEWERS) revert InvalidReviewers();
        if (p.threshold <= rCount / 2 || p.threshold > rCount) revert InvalidThreshold();

        id = ++initiativeCount;
        for (uint256 i; i < rCount; ++i) {
            address r = p.reviewers[i];
            if (r == address(0) || isReviewer[id][r]) revert InvalidReviewers();
            if (r == p.grantee) revert InvalidGrantee();
            isReviewer[id][r] = true;
            _reviewers[id].push(r);
        }
        _milestoneAmounts[id] = p.milestoneAmounts;

        Initiative storage ini = _initiatives[id];
        ini.token = p.token;
        ini.grantee = p.grantee;
        ini.proposer = msg.sender;
        ini.goal = goal;
        ini.fundingDeadline = uint64(block.timestamp) + p.fundingDuration;
        ini.qualifyBps = p.qualifyBps;
        ini.reviewerCount = uint8(rCount);
        ini.threshold = p.threshold;
        // status defaults to Funding, phase to AwaitingSubmission

        emit InitiativeCreated(
            id,
            msg.sender,
            p.token,
            p.grantee,
            goal,
            p.qualifyBps,
            ini.fundingDeadline,
            p.threshold,
            p.category
        );
        emit InitiativeDetails(id, p.milestoneAmounts, p.reviewers, p.metadataURI);
    }

    /*//////////////////////////////////////////////////////////////
                                FUNDING
    //////////////////////////////////////////////////////////////*/

    /// @notice Add `amount` to an initiative's pool. Funds stay refundable until released.
    /// @dev Requires prior ERC-20 approval. Reverts for fee-on-transfer tokens. A contribution
    ///      that would exceed the goal reverts, so callers should clamp to the remaining amount.
    ///      Contributions below the token minimum are only accepted when they fill the goal exactly.
    function contribute(uint256 id, uint256 amount) external nonReentrant {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Funding) revert WrongStatus();
        if (block.timestamp > ini.fundingDeadline) revert FundingClosed();
        uint256 remaining = ini.goal - ini.raised;
        // The minimum does not apply to the contribution that exactly fills the goal, so a gap
        // smaller than the minimum can never leave an initiative unable to reach its goal.
        if (amount < minContribution[ini.token] && amount != remaining) revert BelowMinimum();
        if (amount > remaining) revert ExceedsGoal();
        if (liabilities[ini.token] + amount > totalCap[ini.token]) revert CapReached();

        // effects
        if (contributions[id][msg.sender] == 0) ++ini.backers;
        contributions[id][msg.sender] += amount;
        ini.raised += amount;
        liabilities[ini.token] += amount;

        // interaction
        IERC20 token = IERC20(ini.token);
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert FeeOnTransferToken();

        emit Contributed(id, msg.sender, amount, ini.raised);

        if (ini.raised == ini.goal) _activate(id, ini);
    }

    /// @notice Resolve a time-based state. Anyone can call it once the time has passed.
    ///         - Funding past its deadline: proceed with a scaled-down plan if the qualification
    ///           threshold was reached, otherwise fail and open refunds.
    ///         - Selecting past its deadline: no grantee was chosen, fail and open refunds.
    function settle(uint256 id) external {
        Initiative storage ini = _get(id);
        if (ini.status == Status.Funding && block.timestamp > ini.fundingDeadline) {
            bool proceeds = ini.raised != 0 && ini.raised * BPS >= ini.goal * ini.qualifyBps;
            emit FundingSettled(id, proceeds, ini.raised);
            if (proceeds) _activate(id, ini);
            else _fail(id, ini);
        } else if (ini.status == Status.Selecting && block.timestamp > ini.selectionDeadline) {
            _fail(id, ini);
        } else {
            revert NothingToSettle();
        }
    }

    /*//////////////////////////////////////////////////////////////
                          RFP: GRANTEE SELECTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Announce interest in an RFP. Purely informational: it emits an event only.
    function applyAsGrantee(uint256 id, string calldata pitchURI) external {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Selecting) revert WrongStatus();
        emit GranteeApplied(id, msg.sender, pitchURI);
    }

    /// @notice A reviewer votes for the grantee of a funded RFP. One vote per reviewer, final.
    ///         The first candidate to reach the approval threshold becomes the grantee.
    function voteGrantee(uint256 id, address candidate) external {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Selecting) revert WrongStatus();
        if (block.timestamp > ini.selectionDeadline) revert ReviewWindowClosed();
        if (!isReviewer[id][msg.sender]) revert NotReviewer();
        if (reviewerChoice[id][msg.sender] != address(0)) revert AlreadyVoted();
        if (candidate == address(0) || isReviewer[id][candidate]) revert InvalidCandidate();

        reviewerChoice[id][msg.sender] = candidate;
        uint8 votes = ++candidateVotes[id][candidate];
        emit GranteeVote(id, msg.sender, candidate);

        if (votes >= ini.threshold) {
            ini.grantee = candidate;
            ini.status = Status.Active;
            ini.lastActivity = uint64(block.timestamp);
            emit GranteeSelected(id, candidate);
        }
    }

    /*//////////////////////////////////////////////////////////////
                           MILESTONE DELIVERY
    //////////////////////////////////////////////////////////////*/

    /// @notice The grantee submits the current milestone for review. Evidence is a link
    ///         (repository, report, ...) emitted for the committee; the contract does not read it.
    function submitMilestone(uint256 id, string calldata evidenceURI) external {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Active) revert WrongStatus();
        if (msg.sender != ini.grantee) revert NotGrantee();
        if (ini.phase != Phase.AwaitingSubmission) revert WrongPhase();

        ++ini.reviewNo;
        ++ini.submissionsForCurrent;
        ini.phase = Phase.UnderReview;
        ini.reviewStartedAt = uint64(block.timestamp);
        ini.lastActivity = uint64(block.timestamp);
        ini.approvals = 0;
        ini.rejections = 0;

        emit MilestoneSubmitted(id, ini.currentMilestone, ini.reviewNo, evidenceURI);
    }

    /// @notice A reviewer approves or rejects the milestone under review. One vote per reviewer
    ///         per submission. The decision is final as soon as it is mathematically settled.
    function voteMilestone(uint256 id, bool approve) external {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Active) revert WrongStatus();
        if (ini.phase != Phase.UnderReview) revert WrongPhase();
        if (!isReviewer[id][msg.sender]) revert NotReviewer();
        if (block.timestamp > ini.reviewStartedAt + REVIEW_PERIOD) revert ReviewWindowClosed();
        if (hasVoted[id][ini.reviewNo][msg.sender]) revert AlreadyVoted();

        hasVoted[id][ini.reviewNo][msg.sender] = true;
        uint8 milestone = ini.currentMilestone;
        emit ReviewVote(id, milestone, msg.sender, approve);

        if (approve) {
            if (++ini.approvals >= ini.threshold) _approve(id, ini);
        } else {
            // approval is impossible once more reviewers than (count - threshold) have rejected
            if (++ini.rejections > ini.reviewerCount - ini.threshold) _rejectRound(id, ini, false);
        }
    }

    /// @notice Close a review the committee left undecided past REVIEW_PERIOD. Silence counts as
    ///         a rejected round: nothing is paid, and the round is used up.
    function expireReview(uint256 id) external {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Active) revert WrongStatus();
        if (ini.phase != Phase.UnderReview) revert WrongPhase();
        if (block.timestamp <= ini.reviewStartedAt + REVIEW_PERIOD) revert ReviewWindowOpen();
        _rejectRound(id, ini, true);
    }

    /// @notice Cancel an initiative whose grantee has not submitted anything for
    ///         SUBMISSION_WINDOW. Unspent funds become refundable to funders.
    function cancelIdle(uint256 id) external {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Active) revert WrongStatus();
        if (ini.phase != Phase.AwaitingSubmission) revert WrongPhase();
        if (block.timestamp <= ini.lastActivity + SUBMISSION_WINDOW) revert SubmissionWindowOpen();

        ini.status = Status.Cancelled;
        ini.refundPool = ini.raised - ini.released;
        emit InitiativeCancelled(id, ini.refundPool);
    }

    /*//////////////////////////////////////////////////////////////
                               PAYOUTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Withdraw everything credited to the caller in `token`.
    function withdraw(address token) external nonReentrant {
        uint256 amount = credits[token][msg.sender];
        if (amount == 0) revert NothingToClaim();
        credits[token][msg.sender] = 0;
        liabilities[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(token, msg.sender, amount);
    }

    /// @notice Claim the caller's pro-rata share of the unspent pool of a Failed or Cancelled
    ///         initiative. Shares round down; the few wei of rounding dust stay in the contract.
    function refund(uint256 id) external nonReentrant {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Failed && ini.status != Status.Cancelled) revert WrongStatus();
        uint256 paid = contributions[id][msg.sender];
        if (paid == 0) revert NothingToClaim();

        uint256 amount = (paid * ini.refundPool) / ini.raised;
        contributions[id][msg.sender] = 0;
        liabilities[ini.token] -= amount;
        if (amount != 0) IERC20(ini.token).safeTransfer(msg.sender, amount);
        emit Refunded(id, msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function getInitiative(uint256 id) external view returns (Initiative memory) {
        return _get(id);
    }

    function getMilestoneAmounts(uint256 id) external view returns (uint256[] memory) {
        _get(id);
        return _milestoneAmounts[id];
    }

    function getReviewers(uint256 id) external view returns (address[] memory) {
        _get(id);
        return _reviewers[id];
    }

    /// @notice True once the raised amount meets the initiative's qualification threshold.
    function isQualified(uint256 id) external view returns (bool) {
        Initiative storage ini = _get(id);
        return ini.raised != 0 && ini.raised * BPS >= ini.goal * ini.qualifyBps;
    }

    /// @notice What `account` would receive from {refund} right now (0 if not refundable).
    function refundableOf(uint256 id, address account) external view returns (uint256) {
        Initiative storage ini = _get(id);
        if (ini.status != Status.Failed && ini.status != Status.Cancelled) return 0;
        if (ini.raised == 0) return 0;
        return (contributions[id][account] * ini.refundPool) / ini.raised;
    }

    /*//////////////////////////////////////////////////////////////
                               INTERNALS
    //////////////////////////////////////////////////////////////*/

    function _get(uint256 id) private view returns (Initiative storage ini) {
        if (id == 0 || id > initiativeCount) revert UnknownInitiative();
        ini = _initiatives[id];
    }

    /// @dev Funding ended with enough raised. If the goal was not fully met, milestone amounts are
    ///      scaled down proportionally; the last milestone absorbs rounding so they sum to `raised`.
    function _activate(uint256 id, Initiative storage ini) private {
        if (ini.raised < ini.goal) {
            uint256[] storage amounts = _milestoneAmounts[id];
            uint256 n = amounts.length;
            uint256 assigned;
            for (uint256 i; i < n - 1; ++i) {
                uint256 scaled = (amounts[i] * ini.raised) / ini.goal;
                amounts[i] = scaled;
                assigned += scaled;
            }
            amounts[n - 1] = ini.raised - assigned;
        }
        if (ini.grantee == address(0)) {
            ini.status = Status.Selecting;
            ini.selectionDeadline = uint64(block.timestamp) + SELECTION_PERIOD;
        } else {
            ini.status = Status.Active;
            ini.lastActivity = uint64(block.timestamp);
        }
    }

    function _approve(uint256 id, Initiative storage ini) private {
        uint8 milestone = ini.currentMilestone;
        uint256 amount = _milestoneAmounts[id][milestone];

        ini.released += amount;
        credits[ini.token][ini.grantee] += amount; // already counted in liabilities
        ini.currentMilestone = milestone + 1;
        ini.submissionsForCurrent = 0;
        ini.phase = Phase.AwaitingSubmission;
        ini.lastActivity = uint64(block.timestamp);

        emit MilestoneApproved(id, milestone, ini.grantee, amount);

        if (ini.currentMilestone == _milestoneAmounts[id].length) {
            ini.status = Status.Completed;
            emit InitiativeCompleted(id);
        }
    }

    function _rejectRound(uint256 id, Initiative storage ini, bool lapsed) private {
        emit MilestoneRejected(id, ini.currentMilestone, lapsed);
        ini.phase = Phase.AwaitingSubmission;
        ini.lastActivity = uint64(block.timestamp);
        if (ini.submissionsForCurrent >= MAX_ROUNDS) _fail(id, ini);
    }

    function _fail(uint256 id, Initiative storage ini) private {
        ini.status = Status.Failed;
        ini.refundPool = ini.raised - ini.released;
        emit InitiativeFailed(id, ini.refundPool);
    }
}
