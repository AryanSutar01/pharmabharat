"use client";

import { useId, useState } from "react";
import { useFormatter } from "next-intl";

type Point = { date: string; value: number };

const HEIGHT = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 52 };
const MAX_BAR = 24;
const GAP = 2; // surface gap between adjacent columns
const RADIUS = 4;

/** Rounds the axis max up to a clean number (1, 2, 2.5, 5 × 10ⁿ). */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

/** Column with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Single-series daily column chart (one hue, so no legend — the card title names it).
 * Hover/focus shows a tooltip; the same numbers are available as a table below.
 */
export function ColumnChart({
  points,
  title,
  tableLabel,
  emptyText,
}: {
  points: Point[];
  title: string;
  tableLabel: string;
  /** Shown instead of an empty axis when every value is zero. */
  emptyText?: string;
}) {
  const format = useFormatter();
  const id = useId();
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  const inr = (v: number, compact = false) =>
    format.number(v, { style: "currency", currency: "INR", maximumFractionDigits: compact ? 1 : 0, ...(compact ? { notation: "compact" } : {}) });
  const day = (d: string) => format.dateTime(new Date(`${d}T12:00:00`), { day: "numeric", month: "short" });

  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const plotW = Math.max(width - PAD.left - PAD.right, 50);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.max(Math.min(MAX_BAR, band - GAP), 2);
  const ticks = [0, max / 2, max];
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const total = points.reduce((a, p) => a + p.value, 0);

  if (total === 0 && emptyText) {
    return (
      <div className="grid h-[180px] place-items-center rounded-lg border border-dashed border-line text-center text-sm text-muted">
        <p className="max-w-xs px-4">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative w-full min-w-0"
        ref={(el) => {
          if (!el) return;
          const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
          ro.observe(el);
          return () => ro.disconnect();
        }}
      >
        {/* width=100% so the container, not the SVG, decides the size; the viewBox tracks the measured width. */}
        <svg
          width="100%"
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-labelledby={`${id}-t`}
          className="block overflow-visible"
        >
          <title id={`${id}-t`}>{`${title}: ${inr(total)}`}</title>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tk)} y2={y(tk)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tk)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {inr(tk, true)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const h = (p.value / max) * plotH;
            return (
              <g key={p.date}>
                <path d={columnPath(x, PAD.top + plotH - h, barW, h)} fill="#0d8467" opacity={hover === null || hover === i ? 1 : 0.45} />
                {/* Hit target: the whole band, taller than the mark. */}
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${day(p.date)}: ${inr(p.value)}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="cursor-default outline-none"
                />
              </g>
            );
          })}
          {/* First / middle / last date labels only — never one per column. */}
          {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) =>
            points[i] ? (
              <text
                key={i}
                x={PAD.left + i * band + band / 2}
                y={HEIGHT - 4}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="fill-muted text-[11px]"
              >
                {day(points[i].date)}
              </text>
            ) : null,
          )}
        </svg>
        {hover !== null && points[hover] ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(PAD.left + hover * band + band / 2, 60), width - 60),
              top: Math.max(y(points[hover].value) - 44, 0),
            }}
            role="status"
          >
            <p className="font-semibold text-ink tabular-nums">{inr(points[hover].value)}</p>
            <p className="text-muted">{day(points[hover].date)}</p>
          </div>
        ) : null}
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">{tableLabel}</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full tabular-nums">
            <tbody>
              {points
                .filter((p) => p.value > 0)
                .map((p) => (
                  <tr key={p.date} className="border-b border-line">
                    <td className="py-1 text-muted">{day(p.date)}</td>
                    <td className="py-1 text-right">{inr(p.value)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
