'use client';

import { useState } from 'react';

interface DirectoryShareButtonProps {
  profileUrl: string;
}

export function DirectoryShareButton({ profileUrl }: DirectoryShareButtonProps) {
  const [statusMessage, setStatusMessage] = useState('');

  const onShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Aurrin Founder Profile',
          url: profileUrl,
        });
        setStatusMessage('Profile shared.');
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileUrl);
        setStatusMessage('Profile URL copied.');
        return;
      }

      setStatusMessage('Copy this URL to share:');
    } catch {
      setStatusMessage('Unable to share right now.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <button type="button" onClick={() => void onShare()} style={{ maxWidth: 220 }}>
        Share
      </button>
      {statusMessage ? <p style={{ margin: 0 }}>{statusMessage}</p> : null}
      {statusMessage === 'Copy this URL to share:' ? <p style={{ margin: 0 }}>{profileUrl}</p> : null}
    </div>
  );
}
