'use client';

import { useState } from 'react';
import { Button } from '@heroui/button';

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
    <div className="grid gap-3">
      <Button
        type="button"
        color="primary"
        variant="bordered"
        className="max-w-[220px] border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
        onPress={() => void onShare()}
      >
        Share
      </Button>
      {statusMessage ? (
        <p className="text-sm text-default-500">{statusMessage}</p>
      ) : null}
      {statusMessage === 'Copy this URL to share:' ? (
        <p className="text-sm text-violet-400 break-all">{profileUrl}</p>
      ) : null}
    </div>
  );
}
