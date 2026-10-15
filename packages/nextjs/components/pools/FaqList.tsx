import { ChevronDownIcon } from "@heroicons/react/24/outline";

export type FaqItem = { q: string; a: React.ReactNode };

/** Questions that open in place. Uses the browser's own details element, so it works without scripts. */
export const FaqList = ({ items }: { items: FaqItem[] }) => (
  <div className="surface divide-y divide-base-300">
    {items.map(item => (
      <details key={item.q} className="group">
        <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 font-medium hover:bg-base-200/60">
          <span>{item.q}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pr-10 text-sm leading-relaxed opacity-80">{item.a}</div>
      </details>
    ))}
  </div>
);
