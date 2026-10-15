import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import type { Check } from "~~/lib/analysis";

const TONE = {
  ok: { icon: CheckCircleIcon, cls: "bg-success/15 text-success", label: "Looks fine" },
  note: { icon: InformationCircleIcon, cls: "bg-info/15 text-info", label: "Worth knowing" },
  warn: { icon: ExclamationTriangleIcon, cls: "bg-warning/15 text-warning", label: "Look closely" },
} as const;

/** Facts to read before contributing. Each says what is true and why it matters; there is no score. */
export const RiskPanel = ({ checks }: { checks: Check[] }) => (
  <div className="space-y-3">
    <ul className="surface divide-y divide-base-300 overflow-hidden">
      {checks.map(c => {
        const { icon: Icon, cls, label } = TONE[c.tone];
        return (
          <li key={c.key} className="flex gap-3 p-4">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cls}`}
              title={label}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{label}:</span>
            </span>
            <div className="min-w-0">
              <p className="font-medium">{c.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed opacity-75">{c.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
    <p className="text-xs opacity-60">
      These are facts read from the contract, not a rating and not advice. They cannot tell you whether the work will be
      good.
    </p>
  </div>
);
