/** @jest-environment node */

import { emailTemplateRegistry, renderEmailTemplate } from '../src/lib/email/templates';

describe('email template registry', () => {
  it('contains all required template names', () => {
    expect(Object.keys(emailTemplateRegistry).sort()).toEqual([
      'directory_published',
      'email_verification',
      'founder_approved',
      'founder_match_created',
      'founder_support_confirmation',
      'match_accepted',
      'match_reminder',
      'mentor_match_created',
      'mentor_matched',
      'mentor_matched_intro',
      'password_reset',
      'report_ready',
      'scores_published',
      'social_asset_ready',
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

  it('renders directory publish notification copy', () => {
    const rendered = renderEmailTemplate('directory_published', {
      name: 'Sam Founder',
      company: 'Orbit Labs',
      link: 'https://example.com/public/directory/orbit-labs',
    });

    expect(rendered.subject).toContain("Congratulations! You're now in the Aurrin directory");
    expect(rendered.text).toContain('Sam Founder');
    expect(rendered.text).toContain('https://example.com/public/directory/orbit-labs');
  });

  it('renders mentor match creation semantics', () => {
    const rendered = renderEmailTemplate('mentor_match_created', {
      founder_name: 'Founder One',
      link: 'https://example.com/mentor/matches/match-1',
    });

    expect(rendered.subject).toContain("You've been paired with Founder One! Accept to connect.");
    expect(rendered.text).toContain("You've been paired with Founder One! Accept to connect.");
  });

  it('renders reminder semantics for mentor and founder recipients', () => {
    const mentorReminder = renderEmailTemplate('match_reminder', {
      recipient_role: 'mentor',
      founder_name: 'Founder One',
      link: 'https://example.com/mentor/matches/match-1',
    });
    expect(mentorReminder.text).toContain("Don't forget to respond to your match with Founder One");

    const founderReminder = renderEmailTemplate('match_reminder', {
      recipient_role: 'founder',
      mentor_name: 'Mentor Max',
      link: 'https://example.com/founder',
    });
    expect(founderReminder.text).toContain('Mentor Mentor Max is waiting for your response');
  });

  it('renders mutual acceptance intro semantics with both contacts', () => {
    const rendered = renderEmailTemplate('match_accepted', {
      mentor_name: 'Mentor Max',
      mentor_email: 'mentor@example.com',
      founder_name: 'Founder One',
      founder_email: 'founder@example.com',
      link: 'https://example.com/founder',
    });

    expect(rendered.subject).toContain('Mentor Mentor Max, meet Founder Founder One');
    expect(rendered.text).toContain('Mentor contact: mentor@example.com');
    expect(rendered.text).toContain('Founder contact: founder@example.com');
  });

  it('renders social asset ready template with asset metadata', () => {
    const rendered = renderEmailTemplate('social_asset_ready', {
      name: 'Sam Founder',
      asset_type: 'profile',
      format: 'og',
      event_name: 'Spring Demo Day',
      link: 'https://signed.example/social.png',
    });

    expect(rendered.subject).toContain('profile (OG) share card is ready');
    expect(rendered.text).toContain('Spring Demo Day');
    expect(rendered.text).toContain('https://signed.example/social.png');
  });
});
