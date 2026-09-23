import Link from "next/link";
import { cn } from "@/components/ui";

export type StepInfo = { label: string; done: boolean; reachable: boolean };

/**
 * 3-step progress: a bar showing how much is complete, and numbered steps
 * (✓ when done). Steps you may go back to are links; later ones are not.
 */
export function OnboardingProgress({
  steps,
  current,
  stepOfLabel,
  doneLabel,
}: {
  steps: StepInfo[];
  current: number;
  stepOfLabel: string;
  doneLabel: string;
}) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-brand-800">{stepOfLabel}</span>
        <span className="text-muted">{doneLabel}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={doneLabel}
      >
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2">
        {steps.map((s, i) => {
          const n = i + 1;
          const active = n === current;
          const body = (
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  s.done ? "bg-brand-600 text-white" : active ? "border-2 border-brand-600 text-brand-700" : "border border-line text-muted",
                )}
                aria-hidden
              >
                {s.done ? "✓" : n}
              </span>
              <span className={cn("min-w-0 text-xs leading-tight sm:text-sm", active ? "font-semibold text-ink" : "text-muted")}>{s.label}</span>
            </span>
          );
          return (
            <li key={s.label} aria-current={active ? "step" : undefined}>
              {s.reachable && !active ? (
                <Link href={`/onboarding?step=${n}`} className="block rounded-lg p-1 hover:bg-canvas">
                  {body}
                </Link>
              ) : (
                <div className="p-1">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
