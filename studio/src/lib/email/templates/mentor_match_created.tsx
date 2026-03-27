import { composeTemplate } from './base';
import type { EmailTemplateDefinition } from './types';

export const mentorMatchCreatedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const founderName = typeof data.founder_name === 'string' && data.founder_name ? data.founder_name : 'your founder';
    return composeTemplate({
      subject: `You've been paired with ${founderName}! Accept to connect.`,
      preheader: `You've been paired with ${founderName}! Accept to connect.`,
      bodyLines: [
        `You've been paired with ${founderName}! Accept to connect.`,
      ],
      ctaLabel: 'Review and respond',
      ctaUrl: typeof data.link === 'string' && data.link ? data.link : '{link}',
      data,
    });
  },
};
