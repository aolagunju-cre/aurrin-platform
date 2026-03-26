export interface EmailTemplateData {
  name?: string | null;
  company?: string | null;
  link?: string | null;
  date?: string | null;
  email?: string | null;
  baseUrl?: string | null;
  unsubscribeToken?: string | null;
  [key: string]: unknown;
}

export interface RenderedEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplateDefinition {
  render: (data: EmailTemplateData) => RenderedEmailTemplate;
}
