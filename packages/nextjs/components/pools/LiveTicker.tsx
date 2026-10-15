"use client";

import Link from "next/link";
import { useFeed } from "~~/lib/feed";

/** A slow-moving strip of the latest events. Hidden until there is something to show. */
export const LiveTicker = () => {
  const { items } = useFeed(10);
  if (items.length === 0) return null;
  const loop = [...items, ...items];
  return (
    <div className="glass flex items-center overflow-hidden" aria-label="Latest activity">
      <span className="flex shrink-0 items-center gap-2 border-r border-base-300 px-4 py-2.5 text-sm font-semibold">
        <span className="live-dot" aria-hidden="true" />
        Live
      </span>
      <div className="marquee-mask min-w-0 flex-1 overflow-hidden">
        <ul className="marquee m-0 flex w-max list-none gap-10 p-0 py-2.5 pr-10 text-sm">
          {loop.map((it, i) => (
            <li key={`${it.key}-${i}`} aria-hidden={i >= items.length} className="whitespace-nowrap">
              <Link
                href={`/initiative/${it.id}`}
                className="opacity-85 hover:text-primary hover:opacity-100"
                tabIndex={i >= items.length ? -1 : 0}
              >
                {it.text}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
