import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const welcomeFounderTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: `Application received: ${common.company}`,
      preheader: 'We received your founder application.',
      bodyLines: [
        `Hi ${common.name},`,
        `Thanks for applying to Aurrin Ventures for ${common.company}.`,
        'We will review your submission and keep you updated.',
      ],
      ctaLabel: 'View application status',
      ctaUrl: common.link,
      data,
    });
  },
};
