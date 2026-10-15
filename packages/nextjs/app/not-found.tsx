import Link from "next/link";
import { Logo } from "~~/components/Header";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="glass tile max-w-lg space-y-6 p-8 text-center sm:p-10">
        <div className="flex justify-center opacity-90">
          <Logo className="[&>span:last-child]:sr-only" />
        </div>
        <div className="space-y-2">
          <p className="gold-text text-6xl font-bold leading-none tabular">404</p>
          <h1 className="text-2xl font-semibold">This page does not exist</h1>
          <p className="text-sm leading-relaxed opacity-75">
            The link may be old or mistyped. Initiatives are numbered from 1, so check the number, or browse the full
            list.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/explore" className="btn btn-primary">
            Explore initiatives
          </Link>
          <Link href="/" className="btn border-base-300 bg-base-100">
            Back to home
          </Link>
          <Link href="/faq" className="btn btn-ghost">
            Read the FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
