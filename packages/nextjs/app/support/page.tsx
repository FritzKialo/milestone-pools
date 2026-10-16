"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { ClipboardDocumentIcon, EnvelopeIcon, LifebuoyIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { FaqList } from "~~/components/pools/FaqList";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { IS_TESTNET, REPO_URL, SUPPORT_EMAIL } from "~~/lib/site";

const FIXES = [
  {
    q: "A transaction fails with a wrong network message",
    a: "You can browse from any network, but sending a transaction needs your wallet on the network shown in the footer (Network: ...). Switch to it in your wallet, then try again.",
  },
  ...(IS_TESTNET
    ? [
        {
          q: "I have no Sepolia ETH or test USDC",
          a: "Sepolia ETH pays for gas and comes from a public Sepolia faucet. The USDC here is a test token with no value. The contribute box has a button to mint some for your wallet when you are on a test network.",
        },
      ]
    : []),
  {
    q: "Why are there two wallet prompts when I contribute?",
    a: "The first one approves the contract to take that amount of USDC from you. The second one makes the contribution. Both are needed, and you can skip the first when you have already approved enough.",
  },
  {
    q: "A transaction has been pending for a long time",
    a: "Your wallet may be waiting on a busy network. Check the transaction in your wallet or on the block explorer. If it is still pending after several minutes, use the wallet's speed up or cancel option. Nothing changes on the initiative until the transaction is confirmed.",
  },
  {
    q: "I cannot withdraw my contribution",
    a: "While an initiative is still funding or paying out, contributions stay in the pool. You can claim a refund only when the initiative fails or is cancelled, and the refund is your share of whatever has not been paid out yet.",
  },
  {
    q: "My refund is smaller than what I put in",
    a: "If one or more milestones were already paid out before the initiative stopped, that money is gone. The refund is split across backers in proportion to what each of them contributed. The payout simulator on each initiative page shows this before you contribute.",
  },
  {
    q: "I do not see an initiative I just created",
    a: "Wait for the transaction to confirm, then reload. The list refreshes every few seconds. Check My activity to confirm it was created from the wallet you expect.",
  },
];

const Support: NextPage = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: pools } = useDeployedContractInfo({ contractName: "MilestonePools" });
  const { data: usdc } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const [copied, setCopied] = useState(false);

  const diagnostics = () =>
    [
      `Page: ${window.location.origin}${window.location.pathname}`,
      `Network: ${targetNetwork.name} (chain ${targetNetwork.id})`,
      `MilestonePools: ${pools?.address ?? "not found"}`,
      `Token: ${usdc?.address ?? "not found"}`,
      "",
      "Initiative ID:",
      "Transaction hash:",
      "What I did:",
      "What I expected:",
      "What happened:",
    ].join("\n");

  const copy = async () => {
    const text = diagnostics();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this report", text);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-10">
      <div className="space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <LifebuoyIcon className="h-8 w-8 text-primary" aria-hidden="true" />
          Support
        </h1>
        <p className="max-w-2xl opacity-75">
          Find a quick fix below, or send us a report. This is a small project run by one person, so replies can take a
          few days.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="fixes">
        <h2 id="fixes" className="text-xl font-semibold">
          Common problems
        </h2>
        <FaqList items={FIXES} />
      </section>

      <section className="surface space-y-4 p-6" aria-labelledby="report">
        <h2 id="report" className="text-xl font-semibold">
          Report a problem
        </h2>
        <p className="text-sm opacity-75">
          A report is easiest to fix when it says which network you were on, which initiative, and the transaction hash.
          The button below copies a template with the network and contract addresses already filled in. It does not
          include your wallet address.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={copy}>
            <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
            {copied ? "Copied" : "Copy report template"}
          </button>
          <a
            className="btn btn-sm gap-1.5 border-base-300 bg-base-100"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Milestone Pools support")}`}
          >
            <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />
            Email {SUPPORT_EMAIL}
          </a>
          {REPO_URL && (
            <a
              className="btn btn-sm border-base-300 bg-base-100"
              href={`${REPO_URL}/issues/new`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open a GitHub issue
            </a>
          )}
        </div>
      </section>

      <section className="surface space-y-3 border-warning/40 p-6" aria-labelledby="security">
        <h2 id="security" className="flex items-center gap-2 text-xl font-semibold">
          <ShieldExclamationIcon className="h-6 w-6 text-warning" aria-hidden="true" />
          Found a security problem?
        </h2>
        <p className="text-sm leading-relaxed opacity-80">
          Please email{" "}
          <a className="link" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Security report")}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          with the subject &quot;Security report&quot; and do not post it publicly first. Describe what you found and
          how to reproduce it. This software is unaudited and there is no bounty program, but reports are read and taken
          seriously.
        </p>
      </section>

      <p className="text-sm opacity-60">
        We cannot recover funds, reverse transactions or change an initiative&apos;s committee. Those are fixed by the
        contract once it is created. Read the Terms and Risks page for what that means.
      </p>
    </div>
  );
};

export default Support;
