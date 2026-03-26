import type { EmailTemplateData, RenderedEmailTemplate } from './types';

const DEFAULT_UNSUBSCRIBE_BASE = '{baseUrl}';
const DEFAULT_UNSUBSCRIBE_TOKEN = '{uuid}';
const DEFAULT_UNSUBSCRIBE_EMAIL = '{email}';

function normalizeDate(rawDate?: string): string {
  if (!rawDate) {
    return 'your upcoming event';
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailQueryValue(email?: string): string {
  if (!email) {
    return DEFAULT_UNSUBSCRIBE_EMAIL;
  }

  return email === DEFAULT_UNSUBSCRIBE_EMAIL ? email : encodeURIComponent(email);
}

function buildUnsubscribeLink(data: EmailTemplateData): string {
  const baseUrl = typeof data.baseUrl === 'string' && data.baseUrl ? data.baseUrl : DEFAULT_UNSUBSCRIBE_BASE;
  const token =
    typeof data.unsubscribeToken === 'string' && data.unsubscribeToken
      ? data.unsubscribeToken
      : DEFAULT_UNSUBSCRIBE_TOKEN;

  return `${baseUrl}/unsubscribe?token=${token}&email=${emailQueryValue(
    typeof data.email === 'string' ? data.email : undefined
  )}`;
}

interface ComposeTemplateArgs {
  subject: string;
  preheader: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  data: EmailTemplateData;
}

export function composeTemplate(args: ComposeTemplateArgs): RenderedEmailTemplate {
  const unsubscribeLink = buildUnsubscribeLink(args.data);
  const safeLines = args.bodyLines.map((line) => escapeHtml(line));
  const renderedCtaUrl = args.ctaUrl ?? args.data.link;

  const htmlBody = safeLines.map((line) => `<p style=\"margin:0 0 12px;\">${line}</p>`).join('');
  const htmlCta =
    args.ctaLabel && renderedCtaUrl
      ? `<p style=\"margin:20px 0;\"><a href=\"${escapeHtml(renderedCtaUrl)}\" style=\"color:#0b5fff;\">${escapeHtml(args.ctaLabel)}</a></p>`
      : '';

  const html = `
<div style="font-family:Helvetica,Arial,sans-serif;line-height:1.5;color:#111827;max-width:680px;margin:0 auto;">
  <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">${escapeHtml(args.preheader)}</p>
  ${htmlBody}
  ${htmlCta}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
  <p style="font-size:12px;color:#6b7280;margin:0;">
    You are receiving this message from Aurrin Ventures. To unsubscribe, click
    <a href="${escapeHtml(unsubscribeLink)}">here</a>.
  </p>
</div>
`.trim();

  const textParts: string[] = [args.preheader, '', ...args.bodyLines];
  if (args.ctaLabel && renderedCtaUrl) {
    textParts.push('', `${args.ctaLabel}: ${renderedCtaUrl}`);
  }
  textParts.push(
    '',
    `You are receiving this message from Aurrin Ventures. Unsubscribe: ${unsubscribeLink}`
  );

  return {
    subject: args.subject,
    html,
    text: textParts.join('\n'),
  };
}

export function withCommonFields(
  data: EmailTemplateData
): { name: string; company: string; link: string; date: string } {
  return {
    name: typeof data.name === 'string' && data.name ? data.name : 'there',
    company: typeof data.company === 'string' && data.company ? data.company : 'your company',
    link: typeof data.link === 'string' && data.link ? data.link : '{link}',
    date: normalizeDate(typeof data.date === 'string' ? data.date : undefined),
  };
}
