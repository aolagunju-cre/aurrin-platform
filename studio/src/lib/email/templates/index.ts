import { founderMatchCreatedTemplate } from './founder_match_created';
import { matchAcceptedTemplate } from './match_accepted';
import { matchReminderTemplate } from './match_reminder';
import { emailVerificationTemplate } from './email_verification';
import { founderApprovedTemplate } from './founder_approved';
import { mentorMatchCreatedTemplate } from './mentor_match_created';
import { mentorMatchedIntroTemplate } from './mentor_matched_intro';
import { mentorMatchedTemplate } from './mentor_matched';
import { passwordResetTemplate } from './password_reset';
import { reportReadyTemplate } from './report_ready';
import { scoresPublishedTemplate } from './scores_published';
import { subscriptionActivatedTemplate } from './subscription_activated';
import { subscriptionCancelledTemplate } from './subscription_cancelled';
import type { EmailTemplateData, RenderedEmailTemplate } from './types';
import { welcomeFounderTemplate } from './welcome_founder';

export const emailTemplateRegistry = {
  welcome_founder: welcomeFounderTemplate,
  founder_approved: founderApprovedTemplate,
  scores_published: scoresPublishedTemplate,
  mentor_match_created: mentorMatchCreatedTemplate,
  founder_match_created: founderMatchCreatedTemplate,
  match_accepted: matchAcceptedTemplate,
  match_reminder: matchReminderTemplate,
  mentor_matched: mentorMatchedTemplate,
  mentor_matched_intro: mentorMatchedIntroTemplate,
  subscription_activated: subscriptionActivatedTemplate,
  subscription_cancelled: subscriptionCancelledTemplate,
  password_reset: passwordResetTemplate,
  email_verification: emailVerificationTemplate,
  report_ready: reportReadyTemplate,
} as const;

export type EmailTemplateName = keyof typeof emailTemplateRegistry;

export function isEmailTemplateName(value: string): value is EmailTemplateName {
  return Object.prototype.hasOwnProperty.call(emailTemplateRegistry, value);
}

export function renderEmailTemplate(
  templateName: EmailTemplateName,
  data: EmailTemplateData
): RenderedEmailTemplate {
  return emailTemplateRegistry[templateName].render(data);
}

export type { EmailTemplateData, RenderedEmailTemplate } from './types';
