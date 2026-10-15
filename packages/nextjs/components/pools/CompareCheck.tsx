"use client";

export type CompareProps = { selected: boolean; disabled: boolean; onToggle: () => void };

/** A small "Compare" checkbox for a card or table row. */
export const CompareCheck = ({
  compare,
  label,
  className = "",
}: {
  compare: CompareProps;
  label: string;
  className?: string;
}) => (
  <label
    className={`flex cursor-pointer items-center gap-2 rounded-lg border border-base-300 bg-base-100/90 px-2.5 py-1 text-xs ${
      compare.disabled && !compare.selected ? "cursor-not-allowed opacity-50" : ""
    } ${className}`}
  >
    <input
      type="checkbox"
      className="checkbox checkbox-xs"
      checked={compare.selected}
      disabled={compare.disabled && !compare.selected}
      onChange={compare.onToggle}
      aria-label={`Compare ${label}`}
    />
    Compare
  </label>
);
