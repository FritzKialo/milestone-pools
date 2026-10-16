"use client";

import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { useWatchlist } from "~~/lib/local";

/** Star an initiative to find it again under "Saved". Stored in this browser only. */
export const SaveButton = ({ uid, className = "", label }: { uid: string; className?: string; label?: boolean }) => {
  const { isSaved, toggle } = useWatchlist();
  const saved = isSaved(uid);
  return (
    <button
      type="button"
      onClick={() => toggle(uid)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this initiative"}
      title={saved ? "Saved in this browser. Click to remove." : "Save in this browser"}
      className={`btn btn-sm ${label ? "gap-1.5" : "btn-circle"} bg-base-100/90 border-base-300 hover:bg-base-100 ${className}`}
    >
      {saved ? <StarSolid className="h-4 w-4 text-warning" /> : <StarOutline className="h-4 w-4" />}
      {label && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
};
