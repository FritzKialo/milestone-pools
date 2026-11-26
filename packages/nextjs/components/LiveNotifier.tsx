"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import { BellIcon } from "@heroicons/react/24/solid";
import { FEED_EVENTS, describeEvent, useTitleMap } from "~~/lib/feed";
import { useWatchlist } from "~~/lib/local";
import { isChainScanComplete, useListings, usePoolEvents } from "~~/lib/pools";

/**
 * Pops a small notice when something new happens on an initiative the visitor saved or is part of
 * (as creator, reviewer or grantee). The visitor's own actions already show their own confirmation.
 *
 * "New" is decided per network: once a network's history has been read in full, the newest block seen then
 * becomes its baseline, and only events after it are announced. A network whose node failed on the first load
 * and caught up later therefore does not replay its whole history as notices.
 */
export const LiveNotifier = () => {
  const { data: events } = usePoolEvents();
  const { listings } = useListings();
  const { saved } = useWatchlist();
  const { address } = useAccount();
  const title = useTitleMap();
  const seen = useRef(new Set<string>());
  const baseline = useRef(new Map<number, bigint>());

  useEffect(() => {
    if (!events) return;

    // Fix a baseline for every network whose history is now complete and does not have one yet.
    const newestByChain = new Map<number, bigint>();
    for (const e of events) {
      const prev = newestByChain.get(e.chainId);
      if (prev === undefined || e.blockNumber > prev) newestByChain.set(e.chainId, e.blockNumber);
    }
    const chainIds = new Set<number>([...newestByChain.keys(), ...listings.map(l => l.chainId)]);
    for (const chainId of chainIds) {
      if (!baseline.current.has(chainId) && isChainScanComplete(chainId)) {
        baseline.current.set(chainId, newestByChain.get(chainId) ?? -1n);
      }
    }

    const me = address?.toLowerCase();
    for (const e of events) {
      const base = baseline.current.get(e.chainId);
      if (base === undefined || e.blockNumber <= base) continue; // history, or network still catching up
      const key = `${e.chainId}-${e.transactionHash}-${e.logIndex}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (!FEED_EVENTS.includes(e.eventName)) continue;

      const item = listings.find(l => l.uid === e.uid);
      const actor = (
        e.eventName === "MilestoneSubmitted"
          ? item?.grantee
          : (e.args?.funder ?? e.args?.reviewer ?? e.args?.proposer ?? e.args?.candidate)
      ) as string | undefined;
      if (me && actor?.toLowerCase() === me) continue;

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
