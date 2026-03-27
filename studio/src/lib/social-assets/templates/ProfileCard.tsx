import React from 'react';
import type { ProfileCardData } from '../types';
import { cardRootStyle, EMBEDDED_BRAND_LOGO_DATA_URI, footerStyle } from './shared';

export function ProfileCard({ founderName, companyName, score, date, eventName }: ProfileCardData): React.ReactElement {
  return (
    <div style={cardRootStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 26, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 }}>Aurrin Founder Profile</div>
          <h1 style={{ margin: '18px 0 8px', fontSize: 74, lineHeight: 1.05 }}>{founderName}</h1>
          <div style={{ fontSize: 38, opacity: 0.95 }}>{companyName}</div>
        </div>
        <img src={EMBEDDED_BRAND_LOGO_DATA_URI} width={88} height={88} alt="Aurrin" />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <div style={{ fontSize: 110, fontWeight: 700, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 30, marginBottom: 16, opacity: 0.9 }}>Aggregate score</div>
      </div>

      <div style={footerStyle}>
        <span>{eventName ?? 'Aurrin Showcase'}</span>
        <span>{date}</span>
      </div>
    </div>
  );
}
