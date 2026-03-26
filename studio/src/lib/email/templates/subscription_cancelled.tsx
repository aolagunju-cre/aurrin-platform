import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const subscriptionCancelledTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: 'Subscription cancelled',
      preheader: 'Your subscription has been cancelled.',
      bodyLines: [
        `Hi ${common.name},`,
        'Your Aurrin Ventures subscription was cancelled.',
        `If this was unexpected, use the link below to reactivate for ${common.company}.`,
      ],
      ctaLabel: 'Manage subscription',
      ctaUrl: common.link,
      data,
    });
  },
};
