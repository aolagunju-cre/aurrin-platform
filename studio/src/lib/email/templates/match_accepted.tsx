import { composeTemplate } from './base';
import type { EmailTemplateDefinition } from './types';

export const matchAcceptedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const mentorName = typeof data.mentor_name === 'string' && data.mentor_name ? data.mentor_name : 'Mentor';
    const founderName = typeof data.founder_name === 'string' && data.founder_name ? data.founder_name : 'Founder';
    const mentorEmail = typeof data.mentor_email === 'string' ? data.mentor_email : '{mentor_email}';
    const founderEmail = typeof data.founder_email === 'string' ? data.founder_email : '{founder_email}';
    const subject = typeof data.subject === 'string' && data.subject
      ? data.subject
      : `Mentor ${mentorName}, meet Founder ${founderName}`;

    return composeTemplate({
      subject,
      preheader: subject,
      bodyLines: [
        `Mentor ${mentorName}, meet Founder ${founderName}.`,
        `Mentor contact: ${mentorEmail}`,
        `Founder contact: ${founderEmail}`,
      ],
      ctaLabel: 'Open mentor match',
      ctaUrl: typeof data.link === 'string' && data.link ? data.link : '{link}',
      data,
    });
  },
};
