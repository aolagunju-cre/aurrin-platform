import { enqueueJob } from '../jobs/enqueue';
import type { OutboxJob } from '../jobs/types';
import { isEmailTemplateName } from './templates';
import type { EmailTemplateData, EmailTemplateName } from './templates';
import {
  getRecipientUnsubscribeState,
  isTransactionalTemplate,
  resolveUnsubscribeBaseUrl,
} from './unsubscribe';

export async function sendEmail(
  to: string,
  templateName: EmailTemplateName | string,
  data: EmailTemplateData
): Promise<OutboxJob | null> {
  const normalizedTo = to.trim().toLowerCase();
  if (!normalizedTo) {
    throw new Error('sendEmail requires a recipient email');
  }

  if (!isEmailTemplateName(templateName)) {
    throw new Error(`Unknown email template: ${templateName}`);
  }

  const recipient = await getRecipientUnsubscribeState(normalizedTo);
  if (!isTransactionalTemplate(templateName) && recipient.unsubscribed) {
    return null;
  }

  return enqueueJob('send_email', {
    to: recipient.recipientEmail,
    template_name: templateName,
    data: {
      ...data,
      email: data.email ?? recipient.recipientEmail,
      unsubscribeToken: data.unsubscribeToken ?? recipient.unsubscribeToken,
      baseUrl: data.baseUrl ?? resolveUnsubscribeBaseUrl(),
    },
  });
}
