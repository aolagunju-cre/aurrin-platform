/** @jest-environment node */

import { emailTemplateRegistry, renderEmailTemplate } from '../src/lib/email/templates';

describe('email template registry', () => {
  it('contains all required template names', () => {
    expect(Object.keys(emailTemplateRegistry).sort()).toEqual([
      'email_verification',
      'founder_approved',
      'mentor_matched',
      'mentor_matched_intro',
      'password_reset',
      'report_ready',
      'scores_published',
      'subscription_activated',
      'subscription_cancelled',
      'welcome_founder',
    ]);
  });

  it('renders both html and plain text with unsubscribe placeholder link', () => {
    const rendered = renderEmailTemplate('welcome_founder', {
      name: 'Jane Doe',
      company: 'Acme Inc',
      link: 'https://example.com/status',
      date: '2026-03-01',
    });

    expect(rendered.subject).toContain('Acme Inc');
    expect(rendered.html).toContain('Jane Doe');
    expect(rendered.html).toContain('https://example.com/status');
    expect(rendered.html).toContain('{baseUrl}/unsubscribe?token={uuid}&amp;email={email}');
    expect(rendered.text).toContain('Unsubscribe: {baseUrl}/unsubscribe?token={uuid}&email={email}');
  });

  it('uses personalization fields where applicable', () => {
    const rendered = renderEmailTemplate('scores_published', {
      name: 'Sam Founder',
      company: 'Orbit Labs',
      date: '2026-04-15',
      link: 'https://example.com/reports/1',
    });

    expect(rendered.subject).toContain('Orbit Labs');
    expect(rendered.text).toContain('Sam Founder');
    expect(rendered.text).toContain('Orbit Labs');
    expect(rendered.text).toContain('https://example.com/reports/1');
    expect(rendered.text).toContain('Your scores are now available');
  });
});
