import { composeTemplate, withCommonFields } from './base';
import type { EmailTemplateDefinition } from './types';

function formatAmount(value: unknown): string {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric / 100);
}

export const founderSupportConfirmationTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const common = withCommonFields(data);
    const founderName = typeof data.founder_name === 'string' ? data.founder_name : 'the founder';
    const amount = formatAmount(data.amount_cents);

    return composeTemplate({
      subject: `Thanks for supporting ${founderName}`,
      preheader: `Your contribution of ${amount} has been received.`,
      bodyLines: [
        `Hi ${common.name},`,
        `Thank you for supporting ${founderName}.`,
        `Contribution amount: ${amount}.`,
      ],
      ctaLabel: common.link ? 'View founder profile' : undefined,
      ctaUrl: common.link,
      data,
    });
  },
};
