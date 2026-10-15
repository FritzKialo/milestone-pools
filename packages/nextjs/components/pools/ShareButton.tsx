"use client";

import { useState } from "react";
import { CheckIcon, ShareIcon } from "@heroicons/react/24/outline";

export const ShareButton = ({ className = "" }: { className?: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };

  return (
    <button type="button" onClick={copy} className={`btn btn-sm gap-1.5 bg-base-100 border-base-300 ${className}`}>
      {copied ? <CheckIcon className="h-4 w-4 text-success" /> : <ShareIcon className="h-4 w-4" />}
      <span>{copied ? "Link copied" : "Share"}</span>
    </button>
  );
};
