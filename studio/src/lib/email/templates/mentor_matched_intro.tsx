import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const mentorMatchedIntroTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: `Intro: mentor and founder for ${common.company}`,
      preheader: 'Your mentor introduction is ready.',
      bodyLines: [
        `Hi ${common.name},`,
        `You are now connected with a mentor for ${common.company}.`,
        `Please use the link below to coordinate your first session on ${common.date}.`,
      ],
      ctaLabel: 'Open introduction details',
      ctaUrl: common.link,
      data,
    });
  },
};
