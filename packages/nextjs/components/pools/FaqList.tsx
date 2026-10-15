import { ChevronDownIcon } from "@heroicons/react/24/outline";

export type FaqItem = { q: string; a: React.ReactNode };

/** Questions that open in place. Uses the browser's own details element, so it works without scripts. */
export const FaqList = ({ items, defaultOpen = false }: { items: FaqItem[]; defaultOpen?: boolean }) => (
  <div className="surface divide-y divide-base-300 overflow-hidden">
    {items.map(item => (
      <details key={item.q} className="group" open={defaultOpen || undefined}>
        <summary className="flex cursor-pointer items-center justify-between gap-4 border-l-2 border-transparent p-4 font-medium hover:bg-base-200/50 group-open:border-primary group-open:bg-base-200/40">
          <span>{item.q}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-l-2 border-primary bg-base-200/40 px-4 pb-4 pr-10 text-sm leading-relaxed opacity-85">
          {item.a}
        </div>
      </details>
    ))}
  </div>
);
