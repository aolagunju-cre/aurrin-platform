import React from 'react';
import type { HighlightCardData } from '../types';
import { cardRootStyle, EMBEDDED_BRAND_LOGO_DATA_URI, footerStyle } from './shared';

export function HighlightCard({ milestone, metric, founderName, date }: HighlightCardData): React.ReactElement {
  return (
    <div style={cardRootStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 26, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 }}>Aurrin Highlight</div>
          <h1 style={{ margin: '18px 0 12px', fontSize: 70, lineHeight: 1.05 }}>{milestone}</h1>
          <div style={{ fontSize: 34, opacity: 0.95 }}>{founderName}</div>
        </div>
        <img src={EMBEDDED_BRAND_LOGO_DATA_URI} width={88} height={88} alt="Aurrin" />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
        <div style={{ fontSize: 94, fontWeight: 700, lineHeight: 1 }}>{metric}</div>
        <div style={{ fontSize: 28, marginBottom: 14, opacity: 0.9 }}>Milestone metric</div>
      </div>

      <div style={footerStyle}>
        <span>Aurrin Ventures</span>
        <span>{date}</span>
      </div>
    </div>
  );
}
