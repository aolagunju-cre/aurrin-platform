import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const mentorMatchedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: `Mentor match ready for ${common.company}`,
      preheader: 'A new mentor match is available.',
      bodyLines: [
        `Hi ${common.name},`,
        `We found a mentor match for ${common.company}.`,
        'Review the match details and accept when ready.',
      ],
      ctaLabel: 'Review mentor match',
      ctaUrl: common.link,
      data,
    });
  },
};
