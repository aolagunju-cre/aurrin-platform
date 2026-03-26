import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const subscriptionActivatedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: 'Subscription activated',
      preheader: 'Your premium access is now active.',
      bodyLines: [
        `Hi ${common.name},`,
        'Your Aurrin Ventures subscription is now active.',
        `You can now access premium resources for ${common.company}.`,
      ],
      ctaLabel: 'Open subscriber dashboard',
      ctaUrl: common.link,
      data,
    });
  },
};
