import Link from "next/link";
import type { Ranked } from "@/lib/analytics";

/**
 * Ranked horizontal bars (single series). Label above, value at the bar tip,
 * so every number is readable without colour or hover.
 */
export function BarList({
  items,
  formatValue,
  sublabel,
  href,
  empty,
}: {
  items: Ranked[];
  formatValue: (v: number) => string;
  sublabel?: (item: Ranked) => string;
  href?: (item: Ranked) => string;
  empty: string;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const label = href ? (
          <Link href={href(item)} className="hover:underline">
            {item.label}
          </Link>
        ) : (
          item.label
        );
        return (
          <li key={item.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{label}</span>
              {sublabel ? <span className="shrink-0 text-xs text-muted">{sublabel(item)}</span> : null}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-3 flex-1">
                <div
                  className="h-3 rounded-r bg-brand-600"
                  style={{ width: `${Math.max((item.value / max) * 100, 1.5)}%` }}
                  aria-hidden
                />
              </div>
              <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums text-ink">{formatValue(item.value)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
