import type { StatusName } from "~~/lib/pools";

const STYLE: Record<StatusName, string> = {
  Funding: "badge-info",
  Selecting: "badge-warning",
  Active: "badge-success",
  Completed: "badge-neutral",
  Failed: "badge-error",
  Cancelled: "badge-error",
};

const LABEL: Record<StatusName, string> = {
  Funding: "Funding",
  Selecting: "Choosing grantee",
  Active: "In progress",
  Completed: "Completed",
  Failed: "Failed",
  Cancelled: "Cancelled",
};

export const StatusBadge = ({ status }: { status: StatusName }) => (
  <span className={`badge badge-soft ${STYLE[status]} gap-1.5 font-medium`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    {LABEL[status]}
  </span>
);
