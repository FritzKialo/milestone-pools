"use client";

import Link from "next/link";
import {
  ArrowUturnLeftIcon,
  BanknotesIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  HandThumbUpIcon,
  PlusCircleIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { type FeedItem, type FeedKind, ago } from "~~/lib/feed";
import { useNow } from "~~/lib/pools";

export const KIND_LABEL: Record<FeedKind, string> = {
  created: "New",
  funded: "Funding",
  review: "Review",
  paid: "Payout",
  finished: "Completed",
  ended: "Ended",
  refund: "Refund",
  work: "Work",
};

const KIND_STYLE: Record<FeedKind, { icon: typeof BanknotesIcon; tone: string }> = {
  created: { icon: PlusCircleIcon, tone: "bg-info/15 text-info" },
  funded: { icon: BanknotesIcon, tone: "bg-primary/15 text-primary" },
  review: { icon: HandThumbUpIcon, tone: "bg-warning/15 text-warning" },
  paid: { icon: CheckCircleIcon, tone: "bg-success/15 text-success" },
  finished: { icon: TrophyIcon, tone: "bg-primary/15 text-primary" },
  ended: { icon: ExclamationTriangleIcon, tone: "bg-error/15 text-error" },
  refund: { icon: ArrowUturnLeftIcon, tone: "bg-warning/15 text-warning" },
  work: { icon: DocumentTextIcon, tone: "bg-info/15 text-info" },
};

export const KindIcon = ({ kind }: { kind: FeedKind }) => {
  const { icon: Icon, tone } = KIND_STYLE[kind];
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`} title={KIND_LABEL[kind]}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
};

/** Recent events as a list. Each line opens the initiative it is about. */
export const FeedList = ({ items, empty }: { items: FeedItem[]; empty: React.ReactNode }) => {
  const now = useNow(30_000);
  if (items.length === 0) return <p className="text-sm opacity-70">{empty}</p>;
  return (
    <ul className="divide-y divide-base-300">
      {items.map(it => (
        <li key={it.key}>
          <Link
            href={`/initiative/${it.id}`}
            className="flex items-center gap-3 py-2.5 text-sm hover:bg-base-200/40 sm:px-1"
          >
            <KindIcon kind={it.kind} />
            <span className="min-w-0 flex-1">{it.text}</span>
            <span className="hidden shrink-0 text-xs opacity-60 sm:block">{ago(it.time, now)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
};
