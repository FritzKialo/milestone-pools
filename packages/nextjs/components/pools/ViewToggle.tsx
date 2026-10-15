"use client";

import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/24/outline";

export const ViewToggle = ({
  view,
  onChange,
}: {
  view: "cards" | "table";
  onChange: (v: "cards" | "table") => void;
}) => {
  const btn = (active: boolean) =>
    `btn btn-sm join-item ${active ? "btn-primary" : "border-base-300 bg-base-100 hover:bg-base-200"}`;
  return (
    <div className="join" role="group" aria-label="Layout">
      <button
        type="button"
        className={btn(view === "cards")}
        aria-pressed={view === "cards"}
        onClick={() => onChange("cards")}
      >
        <Squares2X2Icon className="h-4 w-4" />
        <span className="max-sm:sr-only">Cards</span>
      </button>
      <button
        type="button"
        className={btn(view === "table")}
        aria-pressed={view === "table"}
        onClick={() => onChange("table")}
      >
        <ListBulletIcon className="h-4 w-4" />
        <span className="max-sm:sr-only">Table</span>
      </button>
    </div>
  );
};
