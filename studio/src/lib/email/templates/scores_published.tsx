import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const scoresPublishedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    const eventSummary = typeof data.eventSummary === 'string' && data.eventSummary.trim()
      ? data.eventSummary.trim()
      : `${common.company} founder event`;

    return composeTemplate({
      subject: `Your scores are now available for ${common.company}`,
      preheader: 'Your scores are now available.',
      bodyLines: [
        `Hi ${common.name},`,
        'Your scores are now available.',
        `Publishing date: ${common.date}.`,
        `Events with newly available scores: ${eventSummary}.`,
        'Open your founder portal to review the full score and validation breakdown.',
      ],
      ctaLabel: 'Open founder portal',
      ctaUrl: common.link,
      data,
    });
  },
};
