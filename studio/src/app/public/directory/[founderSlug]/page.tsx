import Link from 'next/link';
import { DirectoryShareButton } from '../../../../components/public/DirectoryShareButton';

interface PublicDirectoryProfilePageProps {
  params: Promise<{ founderSlug: string }>;
}

interface DirectoryProfilePayload {
  success: boolean;
  message?: string;
  data?: {
    founder_slug: string;
    name: string | null;
    company: string | null;
    industry: string | null;
    stage: string | null;
    summary: string | null;
    photo: string | null;
    score: number | null;
    social_links: {
      website: string | null;
      linkedin: string | null;
      twitter: string | null;
    };
    badges: string[];
    deck_link: string | null;
    event: {
      id: string;
      name: string;
      starts_at: string;
      ends_at: string;
    };
  };
}

function toDisplayDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(parsed));
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

async function loadProfile(founderSlug: string): Promise<DirectoryProfilePayload | null> {
  const endpoint = `${getBaseUrl()}/api/public/directory/${encodeURIComponent(founderSlug)}`;

  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const payload = (await response.json()) as DirectoryProfilePayload;

    if (!response.ok || !payload.success) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function toSocialLinkLabel(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default async function PublicDirectoryProfilePage({ params }: PublicDirectoryProfilePageProps) {
  const { founderSlug } = await params;
  const profilePayload = await loadProfile(founderSlug);
  const profile = profilePayload?.data;

  if (!profile) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
        <p role="alert">Founder profile not found.</p>
      </main>
    );
  }

  const profileUrl = `${getBaseUrl()}/public/directory/${encodeURIComponent(profile.founder_slug)}`;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', display: 'grid', gap: '1rem' }}>
      <header style={{ display: 'grid', gap: '0.5rem' }}>
        <h1 style={{ marginBottom: 0 }}>{profile.name ?? 'Founder Profile'}</h1>
        <p style={{ margin: 0 }}>
          <strong>{profile.company ?? 'Company unavailable'}</strong>
        </p>
        <p style={{ margin: 0 }}>Industry: {profile.industry ?? 'Not listed'}</p>
        <p style={{ margin: 0 }}>Stage: {profile.stage ?? 'Not listed'}</p>
      </header>

      {profile.photo ? (
        <img
          src={profile.photo}
          alt={`${profile.name ?? profile.company ?? 'Founder'} profile`}
          style={{ width: '100%', maxWidth: 460, borderRadius: 10 }}
        />
      ) : null}

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ marginBottom: 0 }}>Pitch Summary</h2>
        <p style={{ marginTop: 0 }}>{profile.summary ?? 'Summary not available.'}</p>
      </section>

      <section style={{ display: 'grid', gap: '0.25rem' }}>
        <h2 style={{ marginBottom: 0 }}>Event</h2>
        <p style={{ margin: 0 }}>
          {profile.event.name} · {toDisplayDate(profile.event.starts_at)}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/public/validate/${encodeURIComponent(profile.event.id)}`}>Open Public Event Page</Link>
        </p>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ marginBottom: 0 }}>Profile Highlights</h2>
        <p style={{ margin: 0 }}>Aggregate score: {profile.score ?? 'Not published'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {(profile.badges.length > 0 ? profile.badges : ['Top Score', 'Audience Favorite']).map((badge) => (
            <span key={badge} style={{ border: '1px solid #ccc', borderRadius: 999, padding: '0.2rem 0.65rem' }}>
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ marginBottom: 0 }}>Deck and Social</h2>
        {profile.deck_link ? (
          <p style={{ margin: 0 }}>
            <a href={profile.deck_link} target="_blank" rel="noreferrer">
              Preview Deck
            </a>
          </p>
        ) : (
          <p style={{ margin: 0 }}>Deck link not available.</p>
        )}

        <ul style={{ margin: 0, paddingInlineStart: '1.25rem' }}>
          {profile.social_links.website ? (
            <li>
              Website:{' '}
              <a href={profile.social_links.website} target="_blank" rel="noreferrer">
                {toSocialLinkLabel(profile.social_links.website)}
              </a>
            </li>
          ) : null}
          {profile.social_links.linkedin ? (
            <li>
              LinkedIn:{' '}
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer">
                {toSocialLinkLabel(profile.social_links.linkedin)}
              </a>
            </li>
          ) : null}
          {profile.social_links.twitter ? (
            <li>
              Twitter:{' '}
              <a href={profile.social_links.twitter} target="_blank" rel="noreferrer">
                {toSocialLinkLabel(profile.social_links.twitter)}
              </a>
            </li>
          ) : null}
        </ul>
      </section>

      <DirectoryShareButton profileUrl={profileUrl} />

      <p style={{ margin: 0 }}>
        Interested? Contact {`{Aurrin}`}{' '}
        <a href="mailto:hello@aurrin.com">hello@aurrin.com</a>
      </p>
    </main>
  );
}
