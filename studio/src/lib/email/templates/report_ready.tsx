import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

export const reportReadyTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    return composeTemplate({
      subject: `Report ready for ${common.company}`,
      preheader: 'Your requested report is ready to download.',
      bodyLines: [
        `Hi ${common.name},`,
        `Your report for ${common.company} was generated on ${common.date}.`,
        'Use the link below to download it.',
      ],
      ctaLabel: 'Download report',
      ctaUrl: common.link,
      data,
    });
  },
};
