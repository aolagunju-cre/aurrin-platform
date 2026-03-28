import Link from 'next/link';
import { DirectoryShareButton } from '../../../../components/public/DirectoryShareButton';
import { FounderSupportCheckout } from '../../../../components/public/FounderSupportCheckout';
import { getPublicDirectoryProfile } from '../../../../lib/directory/profile';

interface PublicDirectoryProfilePageProps {
  params: Promise<{ founderSlug: string }>;
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
  const { data: profile } = await getPublicDirectoryProfile(founderSlug);

  if (!profile) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-8">
        <p role="alert" className="py-12 text-center text-default-400">Founder profile not found.</p>
      </main>
    );
  }

  const profileUrl = `${getBaseUrl()}/public/directory/${encodeURIComponent(profile.founder_slug)}`;

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{profile.name ?? 'Founder Profile'}</h1>
        <p className="text-lg text-default-500">
          <strong>{profile.company ?? 'Company unavailable'}</strong>
        </p>
        <p className="text-sm text-default-500">Industry: {profile.industry ?? 'Not listed'}</p>
        <p className="text-sm text-default-500">Stage: {profile.stage ?? 'Not listed'}</p>
      </header>

      {profile.photo ? (
        <img
          src={profile.photo}
          alt={`${profile.name ?? profile.company ?? 'Founder'} profile`}
          className="w-full max-w-md rounded-xl"
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Pitch Summary</h2>
        <p className="text-default-500">{profile.summary ?? 'Summary not available.'}</p>
      </section>

      <section className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Event</h2>
        <p className="text-default-500">
          {profile.event.name} · {toDisplayDate(profile.event.starts_at)}
        </p>
        <p>
          <Link href={`/public/validate/${encodeURIComponent(profile.event.id)}`} className="text-violet-400 hover:text-violet-300 transition-colors">Open Public Event Page</Link>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Profile Highlights</h2>
        <p className="text-default-500">Aggregate score: {profile.score ?? 'Not published'}</p>
        <div className="flex flex-wrap gap-2">
          {(profile.badges.length > 0 ? profile.badges : ['Top Score', 'Audience Favorite']).map((badge) => (
            <span key={badge} className="inline-flex px-3 py-1 rounded-full text-xs font-medium border border-default-200 bg-default-50 dark:bg-default-50/5 text-default-600">
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Deck and Social</h2>
        {profile.deck_link ? (
          <p>
            <a href={profile.deck_link} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
              Preview Deck
            </a>
          </p>
        ) : (
          <p className="text-default-400">Deck link not available.</p>
        )}

        <ul className="list-disc pl-5 space-y-1 text-default-500">
          {profile.social_links.website ? (
            <li>
              Website:{' '}
              <a href={profile.social_links.website} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
                {toSocialLinkLabel(profile.social_links.website)}
              </a>
            </li>
          ) : null}
          {profile.social_links.linkedin ? (
            <li>
              LinkedIn:{' '}
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
                {toSocialLinkLabel(profile.social_links.linkedin)}
              </a>
            </li>
          ) : null}
          {profile.social_links.twitter ? (
            <li>
              Twitter:{' '}
              <a href={profile.social_links.twitter} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
                {toSocialLinkLabel(profile.social_links.twitter)}
              </a>
            </li>
          ) : null}
        </ul>
      </section>

      <DirectoryShareButton profileUrl={profileUrl} />

      <FounderSupportCheckout
        founderSlug={profile.founder_slug}
        founderName={profile.name ?? profile.company ?? 'this founder'}
        founderId={profile.founder_id}
      />

      {profile.donations ? (
        <section className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">Founder Support</h2>
          <p className="text-default-500">
            {profile.donations.count} contributions ·{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(profile.donations.total_cents / 100)}
          </p>
        </section>
      ) : null}

      <p className="text-default-500">
        Interested? Contact {`{Aurrin}`}{' '}
        <a href="mailto:hello@aurrin.com" className="text-violet-400 hover:text-violet-300 transition-colors">hello@aurrin.com</a>
      </p>
    </main>
  );
}
