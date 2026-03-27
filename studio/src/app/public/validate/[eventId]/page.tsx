import { getSupabaseClient } from '../../../../lib/db/client';
import { StartValidationPanel } from '../../../../components/public/StartValidationPanel';

interface ValidateEntryPageProps {
  params: Promise<{ eventId: string }>;
}

function formatEventDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Date to be announced';
  }

  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

export default async function ValidateEntryPage({ params }: ValidateEntryPageProps) {
  const { eventId } = await params;
  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(eventId);

  if (eventResult.error) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
        <p role="alert">Unable to load event details.</p>
      </main>
    );
  }

  if (!eventResult.data) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
        <p role="alert">Event not found.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem', display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>{eventResult.data.name}</h1>
      <p style={{ margin: 0 }}>
        Event date: {formatEventDateRange(eventResult.data.start_date, eventResult.data.end_date)}
      </p>
      <p style={{ margin: 0 }}>
        By continuing, you consent to submit validation feedback for this event. Your responses are used for evaluation and may be reviewed by organizers.
      </p>
      <StartValidationPanel eventId={eventId} />
    </main>
  );
}
