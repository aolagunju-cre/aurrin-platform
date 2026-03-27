import { composeTemplate } from './base';
import type { EmailTemplateData, EmailTemplateDefinition } from './types';

function resolveAssetLabel(data: EmailTemplateData): string {
  const assetType = typeof data.asset_type === 'string' ? data.asset_type : 'social';
  const format = typeof data.format === 'string' ? data.format : 'social';
  return `${assetType} (${format.toUpperCase()})`;
}

export const socialAssetReadyTemplate: EmailTemplateDefinition = {
  render: (data: EmailTemplateData) => {
    const recipient = typeof data.name === 'string' && data.name ? data.name : 'Founder';
    const eventName = typeof data.event_name === 'string' && data.event_name ? data.event_name : 'your event';
    const milestone = typeof data.milestone_label === 'string' && data.milestone_label ? `Milestone: ${data.milestone_label}` : null;
    const assetLabel = resolveAssetLabel(data);

    return composeTemplate({
      subject: `Your ${assetLabel} share card is ready`,
      preheader: 'Your social share asset is ready to download.',
      bodyLines: [
        `Hi ${recipient},`,
        `Your ${assetLabel} share card for ${eventName} is ready.`,
        ...(milestone ? [milestone] : []),
      ],
      ctaLabel: 'Download share card',
      ctaUrl: typeof data.link === 'string' ? data.link : undefined,
      data,
    });
  },
};
