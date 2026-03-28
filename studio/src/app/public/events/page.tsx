import EventGrid from "@/src/components/public/EventGrid";
import Link from "next/link";
import { siteConfig } from "@/src/config/site";
import eventsData from "@/public/events.json";
import { AurrinEvent, Judge } from "@/src/types";

interface JudgeWithEvents extends Judge {
  eventIds: string[];
  eventDates: string[];
}

export default function EventsPage() {
  const judgeMap = new Map<string, JudgeWithEvents>();

  (eventsData.events as AurrinEvent[]).forEach((event) => {
    if (event.status === "past" && event.judges) {
      event.judges.forEach((judge) => {
        if (judge.name !== "Judge Name") {
          const existing = judgeMap.get(judge.name);
          if (existing) {
            existing.eventIds.push(event.id);
            existing.eventDates.push(event.date);
          } else {
            judgeMap.set(judge.name, {
              ...judge,
              eventIds: [event.id],
              eventDates: [event.date],
            });
          }
        }
      });
    }
  });

  const allJudges = Array.from(judgeMap.values()).sort((a, b) => {
    const aLatest = Math.max(...a.eventDates.map((d) => new Date(d).getTime()));
    const bLatest = Math.max(...b.eventDates.map((d) => new Date(d).getTime()));
    return bLatest - aLatest;
  });

  return (
    <div>
      <section className="flex flex-col items-center justify-center gap-4 pb-8">
        <div className="inline-block max-w-2xl text-center justify-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Events</h1>
          <p className="text-lg text-default-500 mt-4">
            Join us for pitch nights, networking, and community building. See
            what is coming up and explore highlights from past events.
          </p>
        </div>
        <Link
          href={siteConfig.links.events}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-500 hover:text-violet-400 transition-colors text-sm"
        >
          Register on Eventbrite →
        </Link>
      </section>

      {/* CTA Banner */}
      <section className="mb-10 p-6 md:p-8 rounded-2xl bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 border border-violet-500/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              Ready to share your idea?
            </h2>
            <p className="text-default-500">
              Sign up to pitch at our next event or join as a judge to help founders grow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={siteConfig.links.pitchSignup}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
            >
              Apply to Pitch
            </a>
            <a
              href={siteConfig.links.judgeSignup}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-full border border-violet-500 text-violet-500 hover:bg-violet-500 hover:text-white font-medium transition-all"
            >
              Become a Judge
            </a>
          </div>
        </div>
      </section>

      <EventGrid />

      {/* Judges Section */}
      {allJudges.length > 0 && (
        <section className="mt-16">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium tracking-wide uppercase mb-4">
              Our Judges
            </span>
            <h2 className="text-2xl md:text-3xl font-semibold">
              Industry Leaders & Experts
            </h2>
            <p className="text-default-500 mt-2 max-w-xl mx-auto">
              Our judges bring diverse expertise from across the startup ecosystem to provide valuable feedback to founders.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allJudges.map((judge, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 hover:border-violet-500/50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  {judge.photo ? (
                    <img
                      src={judge.photo}
                      alt={judge.name}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
                      {judge.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{judge.name}</h3>
                    <p className="text-violet-500 text-sm font-medium">
                      {judge.title}
                    </p>
                  </div>
                </div>

                {judge.linkedIn && (
                  <div className="mt-4 pt-4 border-t border-default-200 dark:border-gray-700">
                    <a
                      href={judge.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-default-400 hover:text-violet-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      LinkedIn
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-default-500 mb-4">
              Interested in judging at a future event?
            </p>
            <a
              href={siteConfig.links.judgeSignup}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
            >
              Apply to Judge
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
