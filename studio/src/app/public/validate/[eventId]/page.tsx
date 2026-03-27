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
      <main className="container mx-auto max-w-3xl px-6 py-8">
        <p role="alert" className="py-12 text-center text-default-400">Unable to load event details.</p>
      </main>
    );
  }

  if (!eventResult.data) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-8">
        <p role="alert" className="py-12 text-center text-default-400">Event not found.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{eventResult.data.name}</h1>
      <p className="text-lg text-default-500">
        Event date: {formatEventDateRange(eventResult.data.start_date, eventResult.data.end_date)}
      </p>
      <p className="text-sm text-default-400">
        By continuing, you consent to submit validation feedback for this event. Your responses are used for evaluation and may be reviewed by organizers.
      </p>
      <StartValidationPanel eventId={eventId} />
    </main>
  );
}
