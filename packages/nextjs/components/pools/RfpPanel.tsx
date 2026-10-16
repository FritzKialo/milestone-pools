"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import { type Initiative, ZERO_ADDRESS, eventsFor, fmtDate, safeLink, shortAddr, usePoolEvents } from "~~/lib/pools";

/** Open call: anyone can offer to do the work; the committee votes on who. */
export const RfpPanel = ({ item, reviewers }: { item: Initiative; reviewers: `0x${string}`[] }) => {
  const { address } = useAccount();
  const id = BigInt(item.id);
  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "MilestonePools" });
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: events } = usePoolEvents();

  const candidates = useMemo(() => {
    const map = new Map<string, string>();
    eventsFor(events, "GranteeApplied", item.id).forEach(e =>
      map.set((e.args.candidate as string).toLowerCase(), e.args.pitchURI as string),
    );
    return Array.from(map.entries()).map(([addr, uri]) => ({ addr: addr as `0x${string}`, uri }));
  }, [events, item.id]);

  const { targetNetwork } = useTargetNetwork();
  const { data: counts } = useReadContracts({
    contracts: (pools
      ? candidates.map(c => ({
          chainId: targetNetwork.id,
          address: pools.address,
          abi: pools.abi,
          functionName: "candidateVotes",
          args: [id, c.addr],
        }))
      : []) as any,
    query: { enabled: !!pools && candidates.length > 0, refetchInterval: 4000 },
  });

  const { data: myChoice } = useScaffoldReadContract({
    contractName: "MilestonePools",
    functionName: "reviewerChoice",
    args: [id, address],
    watch: true,
  });

  const isReviewer = !!address && reviewers.some(r => r.toLowerCase() === address.toLowerCase());
  const hasVoted = !!myChoice && myChoice !== ZERO_ADDRESS;
  const pitchOk = !!safeLink(pitch.trim());

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-80">
        This is an open call. Funding is secured; the committee now chooses who does the work. A candidate needs{" "}
        {item.threshold} of {item.reviewerCount} votes before {fmtDate(item.selectionDeadline)}, otherwise everything is
        refunded.
      </p>

      {candidates.length === 0 ? (
        <p className="text-sm opacity-70">No one has offered yet.</p>
      ) : (
        <ul className="divide-y divide-base-300 border border-base-300">
          {candidates.map((c, k) => {
            const votes = counts?.[k]?.status === "success" ? Number(counts[k].result) : 0;
            const link = safeLink(c.uri);
            return (
              <li key={c.addr} className="p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm">{shortAddr(c.addr)}</div>
                  {link ? (
                    <a className="link text-sm break-all" href={link} target="_blank" rel="noreferrer">
                      Pitch
                    </a>
                  ) : (
                    <span className="text-sm opacity-70">No pitch link</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    {votes} / {item.threshold} votes
                  </span>
                  {isReviewer && !hasVoted && (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!!busy}
                      onClick={() =>
                        run(c.addr, () => writeContractAsync({ functionName: "voteGrantee", args: [id, c.addr] }))
                      }
                    >
                      {busy === c.addr ? <span className="loading loading-spinner loading-xs" /> : "Vote"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {isReviewer && hasVoted && <p className="text-sm">You voted for {shortAddr(myChoice as string)}.</p>}

      {address && (
        <div className="border border-base-300 p-4 space-y-3">
          <h3 className="font-semibold">Offer to do this work</h3>
          <p className="text-sm opacity-80">
            Share a link to your pitch. This only announces your interest; the committee decides. Committee members
            cannot be candidates.
          </p>
          <input
            className="input input-bordered w-full"
            placeholder="https://... or ipfs://..."
            value={pitch}
            onChange={e => setPitch(e.target.value)}
            aria-label="Pitch link"
          />
          <button
            className="btn btn-neutral"
            disabled={!pitchOk || !!busy}
            onClick={() =>
              run("apply", async () => {
                await writeContractAsync({ functionName: "applyAsGrantee", args: [id, pitch.trim()] });
                setPitch("");
              })
            }
          >
            {busy === "apply" ? <span className="loading loading-spinner loading-sm" /> : "Announce interest"}
          </button>
        </div>
      )}
    </div>
  );
};
