'use client';

import React, { useMemo, useState } from 'react';
import { HistogramPoint } from '../../../lib/admin/analytics-client';

interface HistogramChartProps {
  title: string;
  points: HistogramPoint[];
}

export function HistogramChart({ title, points }: HistogramChartProps): React.ReactElement {
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const maxCount = useMemo(() => Math.max(1, ...points.map((point) => point.count)), [points]);
  const selectedPoint = points.find((point) => point.range === selectedRange) ?? null;

  return (
    <article className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 grid gap-3 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10">
      <h2 className="m-0 text-lg font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-5 gap-2 items-end">
        {points.map((point) => (
          <button
            key={point.range}
            type="button"
            title={`${point.range}: ${point.count} founder(s)`}
            aria-label={`Histogram bin ${point.range}`}
            onClick={() => setSelectedRange(point.range)}
            className={`grid gap-1 rounded-xl p-1.5 transition-all duration-300 cursor-pointer border-2 ${
              selectedRange === point.range
                ? 'border-violet-500 bg-violet-500/10 shadow-md shadow-violet-500/10'
                : 'border-default-200 bg-default-100 hover:border-violet-500/50'
            }`}
          >
            <span
              className="block rounded-t-lg bg-violet-500 transition-all duration-300 hover:bg-violet-400"
              style={{
                height: `${Math.max(8, Math.round((point.count / maxCount) * 96))}px`,
              }}
            />
            <span className="text-xs text-default-600">{point.range}</span>
          </button>
        ))}
      </div>
      {selectedPoint ? (
        <p className="m-0 text-sm text-default-600">
          Drill-down: <strong className="text-foreground">{selectedPoint.range}</strong> has{' '}
          <strong className="text-2xl font-bold text-violet-400">{selectedPoint.count}</strong> founder score(s).
        </p>
      ) : (
        <p className="m-0 text-sm text-default-400">Tip: click a bar to drill into that score range.</p>
      )}
    </article>
  );
}
