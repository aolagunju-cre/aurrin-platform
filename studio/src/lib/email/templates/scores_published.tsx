import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const scoresPublishedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: `Scores published for ${common.company}`,
      preheader: 'Judge scoring results are now available.',
      bodyLines: [
        `Hi ${common.name},`,
        `Your latest score report for ${common.company} was published on ${common.date}.`,
        'Open your dashboard to review the full breakdown.',
      ],
      ctaLabel: 'View score report',
      ctaUrl: common.link,
      data,
    });
  },
};
