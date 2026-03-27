'use client';

import React, { useMemo, useState } from 'react';

interface LineTrendPoint {
  id: string;
  label: string;
  date: string;
  value: number;
}

interface LineTrendChartProps {
  title: string;
  yAxisLabel: string;
  points: LineTrendPoint[];
}

function toPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function LineTrendChart({ title, yAxisLabel, points }: LineTrendChartProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const maxValue = useMemo(() => Math.max(1, ...points.map((point) => point.value)), [points]);
  const selected = points.find((point) => point.id === selectedId) ?? null;

  const gridColsClass = `grid-cols-[repeat(${Math.max(1, points.length)},minmax(60px,1fr))]`;

  return (
    <article className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 grid gap-3 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10">
      <h2 className="m-0 text-lg font-semibold text-foreground">{title}</h2>
      <p className="m-0 text-sm text-default-500">{yAxisLabel}</p>
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, points.length)}, minmax(60px, 1fr))` }}
      >
        {points.map((point) => (
          <button
            key={point.id}
            type="button"
            title={`${point.label} (${point.date}): ${toPercent(point.value)}`}
            aria-label={`Trend point ${point.label}`}
            onClick={() => setSelectedId(point.id)}
            className={`grid gap-1 rounded-xl p-1.5 transition-all duration-300 cursor-pointer border-2 ${
              selectedId === point.id
                ? 'border-violet-500 bg-violet-500/10 shadow-md shadow-violet-500/10'
                : 'border-default-200 bg-default-100 hover:border-violet-500/50'
            }`}
          >
            <span
              className="block rounded-t-lg bg-violet-500 transition-all duration-300 hover:bg-violet-400"
              style={{
                height: `${Math.max(8, Math.round((point.value / maxValue) * 96))}px`,
              }}
            />
            <span className="text-xs text-default-600">{point.label}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <p className="m-0 text-sm text-default-600">
          Drill-down: <strong className="text-foreground">{selected.label}</strong> on{' '}
          <strong className="text-foreground">{selected.date}</strong> is{' '}
          <strong className="text-2xl font-bold text-violet-400">{toPercent(selected.value)}</strong>.
        </p>
      ) : (
        <p className="m-0 text-sm text-default-400">Tip: click a point to inspect an event snapshot.</p>
      )}
    </article>
  );
}
