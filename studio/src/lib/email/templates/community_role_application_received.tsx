import { composeTemplate } from './base';
import type { EmailTemplateDefinition } from './types';

function readOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export const communityRoleApplicationReceivedTemplate: EmailTemplateDefinition = {
  render: (data) => {
    const role = readOptionalText(data.role)?.toLowerCase() === 'mentor' ? 'mentor' : 'judge';
    const roleLabel = role === 'mentor' ? 'Mentor' : 'Judge';
    const fullName = readOptionalText(data.name) ?? 'Unknown applicant';
    const email = readOptionalText(data.email) ?? 'No email provided';
    const expertise = readOptionalText(data.expertise) ?? 'No expertise provided';
    const linkedin = readOptionalText(data.linkedin);
    const motivation = readOptionalText(data.motivation);
    const availability = readOptionalText(data.availability);
    const howCanHelp = readOptionalText(data.how_can_help);

    const bodyLines = [
      `A new ${roleLabel.toLowerCase()} application was submitted through the public apply page.`,
      `Applicant: ${fullName}`,
      `Email: ${email}`,
      `Expertise: ${expertise}`,
      linkedin ? `LinkedIn: ${linkedin}` : 'LinkedIn: Not provided',
      motivation ? `Motivation: ${motivation}` : '',
      availability ? `Availability: ${availability}` : '',
      howCanHelp ? `How they can help: ${howCanHelp}` : '',
    ].filter((line) => line.length > 0);

    return composeTemplate({
      subject: `New ${roleLabel} application: ${fullName}`,
      preheader: `New ${roleLabel.toLowerCase()} application submitted`,
      bodyLines,
      data,
    });
  },
};
