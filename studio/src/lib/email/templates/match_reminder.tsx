import { composeTemplate } from './base';
import type { EmailTemplateDefinition } from './types';

export const matchReminderTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const recipientRole = data.recipient_role === 'founder' ? 'founder' : 'mentor';
    const founderName = typeof data.founder_name === 'string' && data.founder_name ? data.founder_name : 'your founder';
    const mentorName = typeof data.mentor_name === 'string' && data.mentor_name ? data.mentor_name : 'your mentor';

    const reminderLine = recipientRole === 'founder'
      ? `Mentor ${mentorName} is waiting for your response`
      : `Don't forget to respond to your match with ${founderName}`;

    return composeTemplate({
      subject: reminderLine,
      preheader: reminderLine,
      bodyLines: [reminderLine],
      ctaLabel: 'Respond to match',
      ctaUrl: typeof data.link === 'string' && data.link ? data.link : '{link}',
      data,
    });
  },
};
