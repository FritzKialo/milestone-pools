"use client";

import { fmtDateTime, useActivity } from "~~/lib/pools";

export const ActivityLog = ({ uid }: { uid: string }) => {
  const { data, isLoading } = useActivity(uid);
  if (isLoading) return <span className="loading loading-spinner loading-sm" />;
  if (!data || data.length === 0) return <p className="text-sm opacity-70">Nothing has happened yet.</p>;
  return (
    <ul className="divide-y divide-base-300">
      {data.map(a => (
        <li key={a.key} className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
          <span>{a.text}</span>
          <span className="opacity-60 shrink-0">{a.time ? fmtDateTime(a.time) : ""}</span>
        </li>
      ))}
    </ul>
  );
};
