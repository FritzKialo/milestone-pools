import { InformationCircleIcon } from "@heroicons/react/24/outline";

/** A small "i" that explains a term on hover or keyboard focus. */
export const Hint = ({ text, side = "top" }: { text: string; side?: "top" | "bottom" | "left" | "right" }) => (
  <span
    className={`tooltip tooltip-${side} before:hidden after:hidden hover:before:block hover:after:block focus-within:before:block focus-within:after:block before:max-w-56 before:whitespace-normal before:text-left align-middle`}
    data-tip={text}
  >
    <span tabIndex={0} role="img" aria-label={text} className="inline-flex opacity-60 hover:opacity-100">
      <InformationCircleIcon className="h-4 w-4" />
    </span>
  </span>
);
