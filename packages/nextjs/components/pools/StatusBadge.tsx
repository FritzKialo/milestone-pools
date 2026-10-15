import type { StatusName } from "~~/lib/pools";

const STYLE: Record<StatusName, string> = {
  Funding: "badge-info",
  Selecting: "badge-warning",
  Active: "badge-success",
  Completed: "badge-neutral",
  Failed: "badge-error",
  Cancelled: "badge-error badge-outline",
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
  <span className={`badge ${STYLE[status]} font-medium`}>{LABEL[status]}</span>
);
