"use client";

import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { type Reminder, downloadIcs } from "~~/lib/ics";
import { type Initiative, REVIEW_PERIOD, SUBMISSION_WINDOW } from "~~/lib/pools";

/** Reminders for the dates that matter on this initiative, as a calendar file with alerts a day and an hour before. */
export const CalendarButton = ({ item, title, now }: { item: Initiative; title: string; now: number }) => {
  const reminders: Reminder[] = [];
  const add = (kind: string, label: string, description: string, start: number) => {
    if (start > now)
      reminders.push({ uid: `${item.uid}-${kind}-${start}`, title: `${label}: ${title}`, description, start });
  };

  if (item.status === "Funding")
    add(
      "funding",
      "Funding closes",
      "After this the initiative goes ahead or everyone is refunded.",
      item.fundingDeadline,
    );
  if (item.status === "Selecting")
    add(
      "selecting",
      "Grantee choice closes",
      "If no grantee is chosen by now, everyone is refunded.",
      item.selectionDeadline,
    );
  if (item.status === "Active" && item.phase === "UnderReview")
    add(
      "review",
      "Review closes",
      "Reviewers can vote until now. No decision counts as a rejection.",
      item.reviewStartedAt + REVIEW_PERIOD,
    );
  if (item.status === "Active" && item.phase === "AwaitingSubmission")
    add(
      "silence",
      "Can be cancelled for inactivity",
      "If nothing has been submitted by now, anyone can cancel it and the unpaid part is refunded.",
      item.lastActivity + SUBMISSION_WINDOW,
    );

  if (reminders.length === 0) return null;

  return (
    <button
      type="button"
      className="btn btn-sm gap-1.5 border-base-300 bg-base-100"
      onClick={() => downloadIcs(`milestone-pools-${item.chainId}-${item.id}.ics`, reminders, window.location.href)}
      title="Download a calendar file with reminders a day and an hour before"
    >
      <CalendarDaysIcon className="h-4 w-4" />
      <span>Remind me</span>
    </button>
  );
};
