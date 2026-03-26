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
    <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(60px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
        {points.map((point) => (
          <button
            key={point.range}
            type="button"
            title={`${point.range}: ${point.count} founder(s)`}
            aria-label={`Histogram bin ${point.range}`}
            onClick={() => setSelectedRange(point.range)}
            style={{
              border: selectedRange === point.range ? '2px solid #0a66c2' : '1px solid #bbb',
              borderRadius: 6,
              padding: '0.25rem',
              background: '#fff',
              display: 'grid',
              gap: '0.25rem',
            }}
          >
            <span
              style={{
                height: `${Math.max(8, Math.round((point.count / maxCount) * 96))}px`,
                background: '#0a66c2',
                borderRadius: 4,
                display: 'block',
              }}
            />
            <span style={{ fontSize: '0.8rem' }}>{point.range}</span>
          </button>
        ))}
      </div>
      {selectedPoint ? (
        <p style={{ margin: 0 }}>
          Drill-down: <strong>{selectedPoint.range}</strong> has <strong>{selectedPoint.count}</strong> founder score(s).
        </p>
      ) : (
        <p style={{ margin: 0 }}>Tip: click a bar to drill into that score range.</p>
      )}
    </article>
  );
}
