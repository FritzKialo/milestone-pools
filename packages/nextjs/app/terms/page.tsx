import Link from "next/link";
import type { NextPage } from "next";
import { MULTI_CHAIN } from "~~/lib/chains";
import { IS_TESTNET } from "~~/lib/site";

export const metadata = { title: "Terms & Risks" };

const VERSION = "1.1";
const UPDATED = "16 October 2026";

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="space-y-3 scroll-mt-24">
    <h2 className="text-2xl font-semibold">{title}</h2>
    {children}
  </section>
);

const Risk = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <li className="border border-base-300 p-4">
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="opacity-85 leading-relaxed">{children}</p>
  </li>
);

const Terms: NextPage = () => (
  <div className="mx-auto w-full max-w-3xl px-4 py-10 space-y-10 leading-relaxed">
    <header className="space-y-3">
      <h1 className="text-4xl font-bold">Terms &amp; Risks</h1>
      <p className="text-sm opacity-60">
        Version {VERSION}, updated {UPDATED}
      </p>
      <div className="border-l-4 border-warning bg-base-200 p-4 text-sm">
        <strong>Please read this before you put money in.</strong> This page explains in plain language how Milestone
        Pools works and what can go wrong. It is information, not legal, financial or tax advice, and the person who
        wrote it is not a lawyer. It does not say whether using this in your country is allowed, regulated or taxed.
        That is for you to check.
      </div>
      <nav className="text-sm flex flex-wrap gap-x-5 gap-y-1">
        <a className="link" href="#what">
          What it is
        </a>
        <a className="link" href="#rules">
          The rules
        </a>
        <a className="link" href="#risks">
          Risks
        </a>
        <a className="link" href="#control">
          Who controls what
        </a>
        <a className="link" href="#yours">
          Your responsibilities
        </a>
        <a className="link" href="#changes">
          Changes
        </a>
      </nav>
    </header>

    <Section id="what" title="What it is">
      <p>
        Milestone Pools lets people pool money toward a goal. The money is held by a smart contract, not by a person or
        a company, and is released in steps (milestones) only when a fixed committee of reviewers approves each step.
      </p>
      <p>
        It is software that runs on a public blockchain. It is not a bank, an investment product, a charity, an escrow
        service or a payment processor, and nobody promises that any initiative will succeed or that any milestone will
        be delivered.
      </p>
      {IS_TESTNET && (
        <p>
          <strong>Test version.</strong> While the app shows a test network, the token is a free test token with no
          value, and nothing here involves real money.
        </p>
      )}
    </Section>

    <Section id="rules" title="The rules, in plain language">
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Creating.</strong> Whoever creates an initiative sets the milestones and amounts, the review committee
          (3 to 9 wallets) and how many must approve each milestone (always a majority). After creation none of this can
          be changed by anyone.
        </li>
        <li>
          <strong>Funding.</strong> People contribute during a funding period of 1 to 90 days. If the goal is reached,
          it goes ahead immediately. If the period ends below the goal but at or above the creator&apos;s minimum, it
          goes ahead with every milestone scaled down in proportion. Below the minimum, everyone can take their money
          back in full.
        </li>
        <li>
          <strong>Open calls.</strong> If no grantee was named, anyone can offer to do the work once funding is secured,
          and the committee votes. If they cannot agree within 30 days, everyone is refunded.
        </li>
        <li>
          <strong>Milestones.</strong> The grantee submits a link to evidence. The committee has 14 days to vote. Enough
          approvals credit that milestone&apos;s amount to the grantee, who then withdraws it. Once approval is no
          longer possible, the attempt is rejected right away. If the committee does not decide in time, that also
          counts as a rejection.
        </li>
        <li>
          <strong>Three tries.</strong> A milestone can be submitted up to 3 times. After the third rejection the
          initiative fails and the money not yet paid out is shared back to backers in proportion to what each
          contributed.
        </li>
        <li>
          <strong>Silence.</strong> If a grantee does not submit anything for 60 days, anyone can cancel the initiative,
          and the unpaid part is shared back to backers the same way.
        </li>
        <li>
          <strong>Refunds are not automatic.</strong> You claim your refund and your payments yourself, each in a
          separate transaction.
        </li>
        <li>
          <strong>Rounding.</strong> Shares are rounded down to the smallest unit of the token. A few units of
          &ldquo;dust&rdquo; can stay in the contract after everyone has claimed.
        </li>
      </ul>
    </Section>

    <Section id="risks" title="Risks">
      <p>Using this means accepting these. Some are small, some could cost you everything you put in.</p>
      <ul className="space-y-3">
        <Risk title="The code may have bugs">
          The contract has an automated test suite and a static-analysis pass, and the results are published with the
          code. It has <strong>not</strong> been audited by an independent security firm. Tests and tools do not prove
          code is free of bugs. A bug could lock or lose funds.
        </Risk>
        <Risk title="Bugs cannot be fixed">
          The contract has no owner, no admin, no pause button and no upgrade path. This is deliberate, so nobody can
          take or freeze your funds. It also means that if a flaw is found, nobody can patch the deployed contract.
        </Risk>
        <Risk title="The committee decides, and humans can be wrong or dishonest">
          The contract checks that a majority of the committee voted. It cannot check that the work was good. If a
          majority of reviewers agree with each other, for any reason, they can release money for work that was not
          done, and they can withhold it for work that was. Look at who the reviewers are before you contribute.
        </Risk>
        <Risk title="The grantee may not deliver">
          A grantee can take a payment for one milestone and then stop. You can lose the part already paid out. Only the
          part not yet paid out is protected by the refund rules.
        </Risk>
        <Risk title="Token risk">
          Contributions are held in a token. If that token loses value, is frozen by its issuer or has a flaw, the
          pooled money is affected. Tokens that take a fee on transfer are rejected, but other unusual token behaviour
          could still cause problems.
        </Risk>
        {!IS_TESTNET && (
          <Risk title="USDC can be frozen by its issuer">
            The token is USDC, issued by Circle. Circle can block individual addresses and can pause the token. If an
            address is blocked, it cannot send or receive USDC, including from these contracts. If the contract&apos;s
            own address were blocked, the funds in it would be stuck. Nobody running this site can undo that.
          </Risk>
        )}
        {MULTI_CHAIN && (
          <Risk title="Each network is separate">
            Every network has its own contract, its own funds and its own risks. Funds on one network cannot be used on
            another. A network can have outages, delays or reorganisations, and a transaction can take longer or fail
            while it is unstable. Choose the network knowingly.
          </Risk>
        )}
        {!IS_TESTNET && (
          <Risk title="Beta limits">
            The contracts are in a limited beta. Each has a cap on the size of a single initiative and on the total it
            may hold. The limits are fixed in the contract and exist to keep the possible loss small. They are not a
            guarantee of safety.
          </Risk>
        )}
        <Risk title="Mistakes are permanent">
          Blockchain transactions cannot be reversed. Sending funds with the wrong address, losing your wallet keys or
          approving the wrong amount cannot be undone by anyone. Check addresses carefully, and in particular the
          grantee and committee addresses when you create an initiative.
        </Risk>
        <Risk title="Timing and fees">
          Deadlines are measured in blockchain time, which can differ by a few seconds or more from your clock. Each
          action costs a network fee, and fees can be high when the network is busy. Small contributions may cost more
          in fees than they are worth.
        </Risk>
        <Risk title="Everything is public">
          Addresses, amounts, votes and the links you submit are visible to anyone, permanently. Do not put personal or
          confidential information in an initiative, an evidence link or a pitch.
        </Risk>
        <Risk title="Links can change or disappear">
          Titles, descriptions and evidence are stored as text or links. A link can go offline or change after a vote.
          Reviewers should keep their own copy of what they judged.
        </Risk>
        <Risk title="The website is separate from the contract">
          This website is a convenience. It can go down, contain mistakes or show stale data. The contract keeps working
          without it, and you can always interact with the contract directly with other tools.
        </Risk>
        <Risk title="Rules, tax and the law">
          Laws about pooling money, grants, digital tokens and tax differ between countries and can change. Nothing on
          this site says what is allowed, registered, licensed or taxable where you live or where the grantee lives. If
          it matters for you, ask a qualified professional.
        </Risk>
      </ul>
    </Section>

    <Section id="control" title="Who controls what">
      <ul className="list-disc pl-6 space-y-2">
        <li>Nobody can move, freeze, edit or redirect funds held by the contract except through the rules above.</li>
        <li>The creator cannot change an initiative after creating it, and has no special power over its money.</li>
        <li>Only the named grantee can submit milestones and only they can withdraw the payments credited to them.</li>
        <li>Only the committee votes on milestones and on choosing a grantee, and the committee cannot be changed.</li>
        <li>
          Anyone can trigger the time-based steps (closing funding, closing a lapsed review, cancelling for inactivity).
        </li>
      </ul>
    </Section>

    <Section id="yours" title="Your responsibilities">
      <ul className="list-disc pl-6 space-y-2">
        <li>Only contribute what you can afford to lose.</li>
        <li>Read the initiative, the milestones and the committee before contributing.</li>
        <li>If you are a reviewer, vote honestly and on time. A missed vote counts against the grantee.</li>
        <li>Keep your own keys safe. Nobody can recover them for you.</li>
        <li>Follow the laws and tax rules that apply to you.</li>
      </ul>
    </Section>

    <Section id="changes" title="Changes to this page">
      <p>
        This page is versioned. When it changes, the version number and date at the top change, and the previous text
        stays available in the project&apos;s public history. The contract itself never changes.
      </p>
      <ul className="list-disc pl-6 space-y-1 text-sm">
        <li>
          <strong>1.0</strong> ({UPDATED}): first version.
        </li>
      </ul>
    </Section>

    <div className="pt-4">
      <Link href="/explore" className="btn btn-primary">
        Explore initiatives
      </Link>
    </div>
  </div>
);

export default Terms;
