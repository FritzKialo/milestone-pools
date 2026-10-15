"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="glass tile max-w-lg space-y-6 p-8 text-center sm:p-10" role="alert">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Something went wrong on this page</h1>
          <p className="text-sm leading-relaxed opacity-75">
            Nothing was sent or changed on the blockchain. Try loading the page again. If it keeps happening, check that
            your wallet is on the right network, then reload.
          </p>
          {error.digest && <p className="font-mono text-xs opacity-50">Reference: {error.digest}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn border-base-300 bg-base-100">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
