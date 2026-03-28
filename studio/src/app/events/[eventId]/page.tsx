export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  return (
    <main className="container mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Event {eventId}</h1>
      <p className="text-lg text-default-500 mt-1">Event details.</p>
    </main>
  );
}
