import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const passwordResetTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: 'Reset your password',
      preheader: 'Password reset requested.',
      bodyLines: [
        `Hi ${common.name},`,
        'We received a request to reset your password.',
        'If this was not you, you can ignore this message.',
      ],
      ctaLabel: 'Reset password',
      ctaUrl: common.link,
      data,
    });
  },
};
