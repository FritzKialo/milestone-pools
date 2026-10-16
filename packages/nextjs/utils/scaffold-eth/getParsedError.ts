import { BaseError as BaseViemError, ContractFunctionRevertedError } from "viem";

/** Plain-language messages for the pool contract's own errors. */
export const FRIENDLY_ERRORS: Record<string, string> = {
  TokenNotAllowed: "This token is not accepted by the pools.",
  InvalidMilestones:
    "The milestone amounts are not valid. Each must be above zero and not too small for the chosen minimum.",
  InvalidQualifyBps: "The minimum to go ahead must be between 10% and 100% of the goal.",
  InvalidDuration: "The funding period must be between 1 and 90 days.",
  InvalidReviewers: "The review committee needs 3 to 9 different wallets.",
  InvalidThreshold: "The approvals needed must be more than half of the committee and no more than its size.",
  InvalidGrantee: "That wallet cannot be the grantee.",
  GoalTooLarge:
    "This goal is above the beta limit on this network. Lower the goal and try again. Limits rise as the contracts are audited.",
  CapReached:
    "The pools on this network have reached their total beta limit for now. Try again later, with a smaller amount, or use another network.",
  UnknownInitiative: "That initiative does not exist on this network.",
  WrongStatus: "That action is not available at this stage of the initiative.",
  WrongPhase: "That action is not available at this point in the current milestone.",
  FundingClosed: "Funding for this initiative has closed.",
  BelowMinimum:
    "That is below the minimum contribution. The only exception is the amount that exactly completes the goal.",
  ExceedsGoal: "That is more than the initiative still needs.",
  FeeOnTransferToken: "This token takes a fee on transfer and is not supported.",
  NothingToSettle: "There is nothing to close yet.",
  NotGrantee: "Only the chosen grantee can do this.",
  NotReviewer: "Only members of the review committee can do this.",
  AlreadyVoted: "You have already voted on this.",
  ReviewWindowClosed: "The review period has ended.",
  ReviewWindowOpen: "The review period is still open.",
  SubmissionWindowOpen: "The grantee still has time to submit.",
  InvalidCandidate: "That wallet has not offered to deliver this work.",
  NothingToClaim: "There is nothing for you to claim.",
};

/**
 * Parses an viem/wagmi error to get a displayable string
 * @param e - error object
 * @returns parsed error string
 */
export const getParsedError = (error: any): string => {
  const parsedError = error?.walk ? error.walk() : error;

  if (parsedError instanceof BaseViemError) {
    if (parsedError.details) {
      return parsedError.details;
    }

    if (parsedError.shortMessage) {
      if (
        parsedError instanceof ContractFunctionRevertedError &&
        parsedError.data &&
        parsedError.data.errorName !== "Error"
      ) {
        const friendly = FRIENDLY_ERRORS[parsedError.data.errorName];
        if (friendly) return friendly;
        const customErrorArgs = parsedError.data.args?.toString() ?? "";
        return `${parsedError.shortMessage.replace(/reverted\.$/, "reverted with the following reason:")}\n${
          parsedError.data.errorName
        }(${customErrorArgs})`;
      }

      return parsedError.shortMessage;
    }

    return parsedError.message ?? parsedError.name ?? "An unknown error occurred";
  }

  return parsedError?.message ?? "An unknown error occurred";
};
