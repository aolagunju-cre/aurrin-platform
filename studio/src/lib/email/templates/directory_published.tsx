import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const directoryPublishedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);

    return composeTemplate({
      subject: "Congratulations! You're now in the Aurrin directory",
      preheader: "Congratulations! You're now in the Aurrin directory.",
      bodyLines: [
        `Hi ${common.name},`,
        "Congratulations! You're now in the Aurrin directory.",
        'Your founder profile is now publicly visible so investors and partners can discover your work.',
        'Use your profile link below and share it with your network.',
      ],
      ctaLabel: 'View your public profile',
      ctaUrl: common.link,
      data,
    });
  },
};
