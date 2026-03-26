import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const emailVerificationTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: 'Verify your email address',
      preheader: 'Confirm your email to continue.',
      bodyLines: [
        `Hi ${common.name},`,
        'Please verify your email address to continue using your account.',
        `This helps us keep communication for ${common.company} secure.`,
      ],
      ctaLabel: 'Verify email',
      ctaUrl: common.link,
      data,
    });
  },
};
