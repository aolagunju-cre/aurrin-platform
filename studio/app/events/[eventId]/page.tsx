import { SponsorPlacementSection } from '@/src/components/public/SponsorPlacementSection';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  return (
    <main>
      <h1>Event {eventId}</h1>
      <p>Event details and sponsors.</p>
      <SponsorPlacementSection eventId={eventId} />
    </main>
  );
}
