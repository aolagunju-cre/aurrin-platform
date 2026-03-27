import type { CSSProperties } from 'react';

export const EMBEDDED_BRAND_LOGO_DATA_URI =
  'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" rx="20" fill="%230B6E4F"/%3E%3Cpath d="M26 66 48 22l22 44h-9.5l-12.5-25-12.5 25H26Z" fill="%23FFFFFF"/%3E%3C/svg%3E';

export const cardRootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  background: 'linear-gradient(160deg, #0a1f29 0%, #11384b 60%, #1d5f6f 100%)',
  color: '#f5f8fb',
  fontFamily: 'Arial, Helvetica, sans-serif',
  padding: '48px',
  boxSizing: 'border-box',
};

export const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '24px',
  opacity: 0.95,
};
