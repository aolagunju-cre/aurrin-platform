import { communityRoleApplicationReceivedTemplate } from './community_role_application_received';
import { founderMatchCreatedTemplate } from './founder_match_created';
import { founderSupportConfirmationTemplate } from './founder_support_confirmation';
import { matchAcceptedTemplate } from './match_accepted';
import { matchReminderTemplate } from './match_reminder';
import { directoryPublishedTemplate } from './directory_published';
import { emailVerificationTemplate } from './email_verification';
import { founderApprovedTemplate } from './founder_approved';
import { mentorMatchCreatedTemplate } from './mentor_match_created';
import { mentorMatchedIntroTemplate } from './mentor_matched_intro';
import { mentorMatchedTemplate } from './mentor_matched';
import { passwordResetTemplate } from './password_reset';
import { reportReadyTemplate } from './report_ready';
import { socialAssetReadyTemplate } from './social_asset_ready';
import { scoresPublishedTemplate } from './scores_published';
import { subscriptionActivatedTemplate } from './subscription_activated';
import { subscriptionCancelledTemplate } from './subscription_cancelled';
import type { EmailTemplateData, RenderedEmailTemplate } from './types';
import { welcomeFounderTemplate } from './welcome_founder';

export const emailTemplateRegistry = {
  community_role_application_received: communityRoleApplicationReceivedTemplate,
  welcome_founder: welcomeFounderTemplate,
  founder_approved: founderApprovedTemplate,
  directory_published: directoryPublishedTemplate,
  scores_published: scoresPublishedTemplate,
  mentor_match_created: mentorMatchCreatedTemplate,
  founder_match_created: founderMatchCreatedTemplate,
  founder_support_confirmation: founderSupportConfirmationTemplate,
  match_accepted: matchAcceptedTemplate,
  match_reminder: matchReminderTemplate,
  mentor_matched: mentorMatchedTemplate,
  mentor_matched_intro: mentorMatchedIntroTemplate,
  subscription_activated: subscriptionActivatedTemplate,
  subscription_cancelled: subscriptionCancelledTemplate,
  password_reset: passwordResetTemplate,
  email_verification: emailVerificationTemplate,
  report_ready: reportReadyTemplate,
  social_asset_ready: socialAssetReadyTemplate,
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
