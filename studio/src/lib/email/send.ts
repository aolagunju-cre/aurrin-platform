import { enqueueJob } from '../jobs/enqueue';
import type { OutboxJob } from '../jobs/types';
import { isEmailTemplateName } from './templates';
import type { EmailTemplateData, EmailTemplateName } from './templates';

export async function sendEmail(
  to: string,
  templateName: EmailTemplateName | string,
  data: EmailTemplateData
): Promise<OutboxJob> {
  const normalizedTo = to.trim().toLowerCase();
  if (!normalizedTo) {
    throw new Error('sendEmail requires a recipient email');
  }

  if (!isEmailTemplateName(templateName)) {
    throw new Error(`Unknown email template: ${templateName}`);
  }

  return enqueueJob('send_email', {
    to: normalizedTo,
    template_name: templateName,
    data,
  });
}
