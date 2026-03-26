import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const founderApprovedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: `You are approved: ${common.company}`,
      preheader: 'Your founder application has been approved.',
      bodyLines: [
        `Hi ${common.name},`,
        `Your application for ${common.company} has been approved.`,
        'Use the link below to complete account setup and continue.',
      ],
      ctaLabel: 'Complete account setup',
      ctaUrl: common.link,
      data,
    });
  },
};
