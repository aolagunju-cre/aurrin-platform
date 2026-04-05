import { notFound } from 'next/navigation';
import { getPublicFounderProfileBySlug } from '../../../lib/founders/public-profile';
import { FounderProfileClient } from '../../../components/public/FounderProfileClient';

interface FounderProfilePageProps {
  params: Promise<{ slug: string }>;
}

function toSocialLinkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function toDisplayDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
}

export default async function FounderProfilePage({ params }: FounderProfilePageProps) {
  const { slug } = await params;
  const { data: profile } = await getPublicFounderProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return (
    <main className="container mx-auto max-w-3xl px-6 py-10 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        {profile.photo ? (
          <img
            src={profile.photo}
            alt={`${profile.name ?? profile.company ?? 'Founder'} profile photo`}
            className="w-24 h-24 rounded-full object-cover mb-4"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-default-200 flex items-center justify-center mb-4">
            <span className="text-3xl text-default-400" aria-hidden="true">
              {(profile.name ?? profile.company ?? '?')[0]?.toUpperCase()}
            </span>
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {profile.name ?? profile.company ?? 'Founder Profile'}
        </h1>
        {profile.company ? (
          <p className="text-lg font-medium text-default-600">{profile.company}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 text-sm text-default-500">
          {profile.industry ? (
            <span className="inline-flex items-center rounded-full bg-default-100 px-3 py-1">
              {profile.industry}
            </span>
          ) : null}
          {profile.stage ? (
            <span className="inline-flex items-center rounded-full bg-default-100 px-3 py-1">
              {profile.stage}
            </span>
          ) : null}
        </div>
      </header>

      {/* Bio / Description */}
      {profile.bio ? (
        <section aria-label="About">
          <h2 className="text-xl font-semibold text-foreground mb-2">About</h2>
          <p className="text-default-500 leading-relaxed">{profile.bio}</p>
        </section>
      ) : null}

      {/* Social links */}
      {(profile.socialLinks.website || profile.socialLinks.twitter || profile.socialLinks.linkedin) ? (
        <section aria-label="Social links">
          <h2 className="text-xl font-semibold text-foreground mb-2">Links</h2>
          <ul className="space-y-1 text-sm">
            {profile.socialLinks.website ? (
              <li>
                <a
                  href={profile.socialLinks.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  🌐 {toSocialLinkLabel(profile.socialLinks.website)}
                </a>
              </li>
            ) : null}
            {profile.socialLinks.linkedin ? (
              <li>
                <a
                  href={profile.socialLinks.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  💼 {toSocialLinkLabel(profile.socialLinks.linkedin)}
                </a>
              </li>
            ) : null}
            {profile.socialLinks.twitter ? (
              <li>
                <a
                  href={profile.socialLinks.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:text-violet-300 transition-colors"
                >
                  𝕏 {toSocialLinkLabel(profile.socialLinks.twitter)}
                </a>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {/* Past events / Validation scores */}
      {profile.pastEvents.length > 0 ? (
        <section
          aria-label="Validation scores and past events"
          className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6"
        >
          <h2 className="text-xl font-semibold text-foreground mb-3">Validation History</h2>
          <ul className="space-y-2">
            {profile.pastEvents.map((event) => (
              <li key={event.id} className="text-sm text-default-500">
                <span className="font-medium text-foreground">{event.eventName}</span>
                {event.publishedAt ? ` · ${toDisplayDate(event.publishedAt)}` : null}
                {event.scoreAggregate !== null ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-violet-500/10 text-violet-500 px-2 py-0.5 text-xs font-medium">
                    Score: {event.scoreAggregate}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Mentor endorsements */}
      {profile.mentorEndorsements.length > 0 ? (
        <section aria-label="Mentor endorsements">
          <h2 className="text-xl font-semibold text-foreground mb-2">Mentor Endorsements</h2>
          <ul className="flex flex-wrap gap-2">
            {profile.mentorEndorsements.map((endorsement) => (
              <li
                key={endorsement.mentorId}
                className="inline-flex items-center rounded-full border border-default-200 bg-default-50 dark:bg-default-50/5 px-3 py-1 text-sm text-default-600"
              >
                {endorsement.mentorName ?? 'Mentor'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Interactive: funding progress bar, tier selection, and checkout */}
      <FounderProfileClient
        founderSlug={profile.founderSlug}
        founderName={profile.name ?? profile.company ?? 'this founder'}
        founderId={profile.founderId}
        tiers={profile.tiers}
        fundingGoalCents={profile.fundingGoalCents}
        totalDonatedCents={profile.totalDonatedCents}
      />
    </main>
  );
}
