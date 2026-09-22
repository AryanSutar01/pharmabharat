import { cn } from "@/components/ui";

/**
 * Stat tile: label · value · optional delta vs the previous period.
 * The delta carries an arrow and text, so direction never relies on colour alone.
 */
export function StatTile({
  label,
  value,
  change,
  changeLabel,
  upIsGood = true,
  neutral = false,
  hint,
}: {
  label: string;
  value: string;
  change?: number | null;
  changeLabel?: string;
  upIsGood?: boolean;
  /** The change is neither good nor bad (e.g. a retailer's spend): grey badge. */
  neutral?: boolean;
  hint?: string;
}) {
  const hasChange = typeof change === "number";
  const good = !hasChange || neutral || change === 0 ? null : (change! > 0) === upIsGood;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hasChange ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 font-medium",
              good === null ? "bg-canvas text-muted" : good ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700",
            )}
          >
            <span aria-hidden>{change! > 0 ? "▲" : change! < 0 ? "▼" : "•"}</span>
            {change! > 0 ? "+" : ""}
            {change}%
          </span>
          {changeLabel}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
