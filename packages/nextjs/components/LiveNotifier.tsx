"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import { BellIcon } from "@heroicons/react/24/solid";
import { FEED_EVENTS, describeEvent, useTitleMap } from "~~/lib/feed";
import { useWatchlist } from "~~/lib/local";
import { useListings, usePoolEvents } from "~~/lib/pools";

/**
 * Pops a small notice when something new happens on an initiative the visitor saved or is part of
 * (as creator, reviewer or grantee). The visitor's own actions already show their own confirmation.
 */
export const LiveNotifier = () => {
  const { data: events } = usePoolEvents();
  const { listings } = useListings();
  const { saved } = useWatchlist();
  const { address } = useAccount();
  const title = useTitleMap();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!events) return;
    if (seen.current === null) {
      seen.current = new Set(events.map(e => `${e.chainId}-${e.transactionHash}-${e.logIndex}`));
      return;
    }
    const me = address?.toLowerCase();
    for (const e of events) {
      const key = `${e.chainId}-${e.transactionHash}-${e.logIndex}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (!FEED_EVENTS.includes(e.eventName)) continue;

      const actor = (e.args?.funder ?? e.args?.reviewer ?? e.args?.proposer ?? e.args?.candidate) as string | undefined;
      if (me && actor?.toLowerCase() === me) continue;

      const item = listings.find(l => l.uid === e.uid);
      const involved =
        !!me &&
        !!item &&
        (item.proposer.toLowerCase() === me ||
          item.grantee.toLowerCase() === me ||
          item.reviewers.some(r => r.toLowerCase() === me));
      if (!(e.uid && saved.includes(e.uid)) && !involved) continue;

      toast(describeEvent(e, title), {
        icon: <BellIcon className="h-5 w-5 text-primary" />,
        duration: 6000,
        style: { background: "#12201a", color: "#e8efe9", border: "1px solid #243629", maxWidth: 420 },
      });
    }
  }, [events, listings, saved, address, title]);

  return null;
};
