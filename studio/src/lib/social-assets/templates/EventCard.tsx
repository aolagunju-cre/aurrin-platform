import React from 'react';
import type { EventCardData } from '../types';
import { cardRootStyle, EMBEDDED_BRAND_LOGO_DATA_URI, footerStyle } from './shared';

export function EventCard({ eventName, date, totalFounders, topScore, participationSummary }: EventCardData): React.ReactElement {
  return (
    <div style={cardRootStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 26, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 }}>Aurrin Event Summary</div>
          <h1 style={{ margin: '18px 0 8px', fontSize: 70, lineHeight: 1.05 }}>{eventName}</h1>
          <div style={{ fontSize: 34, opacity: 0.95 }}>{participationSummary}</div>
        </div>
        <img src={EMBEDDED_BRAND_LOGO_DATA_URI} width={88} height={88} alt="Aurrin" />
      </div>

      <div style={{ display: 'flex', gap: 34 }}>
        <div>
          <div style={{ fontSize: 28, opacity: 0.9 }}>Total founders</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{totalFounders}</div>
        </div>
        <div>
          <div style={{ fontSize: 28, opacity: 0.9 }}>Top score</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{topScore}</div>
        </div>
      </div>

      <div style={footerStyle}>
        <span>Aurrin Ventures</span>
        <span>{date}</span>
      </div>
    </div>
  );
}
