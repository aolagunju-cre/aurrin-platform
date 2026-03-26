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

  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
      <p style={{ margin: 0, color: '#555' }}>{yAxisLabel}</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, points.length)}, minmax(60px, 1fr))`, gap: '0.5rem' }}>
        {points.map((point) => (
          <button
            key={point.id}
            type="button"
            title={`${point.label} (${point.date}): ${toPercent(point.value)}`}
            aria-label={`Trend point ${point.label}`}
            onClick={() => setSelectedId(point.id)}
            style={{
              border: selectedId === point.id ? '2px solid #147a00' : '1px solid #bbb',
              borderRadius: 6,
              padding: '0.25rem',
              background: '#fff',
              display: 'grid',
              gap: '0.25rem',
            }}
          >
            <span
              style={{
                height: `${Math.max(8, Math.round((point.value / maxValue) * 96))}px`,
                background: '#147a00',
                borderRadius: 4,
                display: 'block',
              }}
            />
            <span style={{ fontSize: '0.75rem' }}>{point.label}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <p style={{ margin: 0 }}>
          Drill-down: <strong>{selected.label}</strong> on <strong>{selected.date}</strong> is <strong>{toPercent(selected.value)}</strong>.
        </p>
      ) : (
        <p style={{ margin: 0 }}>Tip: click a point to inspect an event snapshot.</p>
      )}
    </article>
  );
}
