import { composeTemplate } from './base';
import type { EmailTemplateDefinition } from './types';

export const founderMatchCreatedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const mentorName = typeof data.mentor_name === 'string' && data.mentor_name ? data.mentor_name : 'your mentor';
    return composeTemplate({
      subject: `You've been paired with Mentor ${mentorName}! Accept to connect.`,
      preheader: `You've been paired with Mentor ${mentorName}! Accept to connect.`,
      bodyLines: [
        `You've been paired with Mentor ${mentorName}! Accept to connect.`,
      ],
      ctaLabel: 'Review and respond',
      ctaUrl: typeof data.link === 'string' && data.link ? data.link : '{link}',
      data,
    });
  },
};
