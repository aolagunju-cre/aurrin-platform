import Link from "next/link";
import eventsData from "@/public/events.json";
import { AurrinEvent } from "@/src/types";
import { getPublicFounderProfileHref } from "@/src/lib/founders/profile-link";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (eventsData.events as AurrinEvent[]).find((e) => e.id === id);

  if (!event) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Event Not Found</h1>
        <p className="text-default-500 mt-2">This event does not exist.</p>
        <Link href="/public/events" className="text-violet-500 hover:text-violet-400 mt-4 inline-block">
          ← Back to Events
        </Link>
      </div>
    );
  }

  const eventDate = new Date(event.date + "T12:00:00");
  const isPast = event.status === "past";

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/public/events" className="text-violet-500 hover:text-violet-400 transition-colors text-sm">
        ← Back to Events
      </Link>

      <div className="mt-6">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isPast
                ? "bg-default-200 dark:bg-default-100/20 text-default-600 dark:text-default-400"
                : "bg-violet-500 text-white"
            }`}
          >
            {isPast ? "Past Event" : "Upcoming"}
          </span>
          <span className="text-sm text-default-500">{event.location}</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground">{event.title}</h1>
        <p className="text-lg text-default-500 mt-1">
          {formatDate(eventDate)} &middot; {event.time}
        </p>
      </div>

      {/* Description */}
      <section className="mt-8">
        <p className="text-default-600 dark:text-default-400 leading-relaxed">{event.description}</p>
        {!isPast && event.eventbriteUrl && (
          <a
            href={event.eventbriteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
          >
            Register on Eventbrite
          </a>
        )}
      </section>

      {/* Judges */}
      {event.judges.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-6">Judges</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {event.judges.map((judge, index) => (
              <div
                key={index}
                className="p-4 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5"
              >
                <div className="flex items-start gap-3">
                  {judge.photo ? (
                    <img src={judge.photo} alt={judge.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {judge.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-sm">{judge.name}</h3>
                    <p className="text-violet-500 text-xs font-medium">{judge.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Founders */}
      {event.founders.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-6">Founders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {event.founders.map((founder, index) => (
              <Link
                key={index}
                href={getPublicFounderProfileHref(founder.company)}
                aria-label={`View ${founder.name} profile`}
                className={`p-4 rounded-2xl border transition-all ${
                  founder.investment?.received
                    ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50"
                    : "border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 hover:border-violet-500/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${
                    founder.investment?.received
                      ? "bg-gradient-to-br from-green-500 to-emerald-600"
                      : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                  }`}>
                    {founder.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{founder.name}</h3>
                    <p className="text-violet-500 text-xs font-medium">{founder.company}</p>
                    {founder.pitchTitle && (
                      <p className="text-xs text-default-500 mt-1 line-clamp-2">{founder.pitchTitle}</p>
                    )}
                    {founder.fundraisingGoal && (
                      <p className="text-xs text-violet-500 font-medium mt-1">Goal: {formatCurrency(founder.fundraisingGoal)}</p>
                    )}
                  </div>
                </div>
                {founder.investment?.received && (
                  <div className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-between">
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Funded</span>
                    {founder.investment.amount && (
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(founder.investment.amount)}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
