import Link from "next/link";
import eventsData from "@/public/events.json";
import { AurrinEvent, Founder } from "@/src/types";
import { getPublicFounderProfileHref } from "@/src/lib/founders/profile-link";

interface FounderWithEvent extends Founder {
  eventId: string;
  eventDate: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function FeaturedCampaigns() {
  const allFounders: FounderWithEvent[] = [];

  (eventsData.events as AurrinEvent[]).forEach((event) => {
    if (event.status === "past" && event.founders) {
      event.founders.forEach((founder) => {
        if (founder.name !== "Founder Name") {
          allFounders.push({
            ...founder,
            eventId: event.id,
            eventDate: event.date,
          });
        }
      });
    }
  });

  // Show invested founders first, then most recent
  allFounders.sort((a, b) => {
    const aInvested = a.investment?.received ? 1 : 0;
    const bInvested = b.investment?.received ? 1 : 0;
    if (bInvested !== aInvested) return bInvested - aInvested;
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  });

  // Show up to 6 featured founders on homepage
  const featured = allFounders.slice(0, 6);

  if (featured.length === 0) return null;

  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <span className="inline-block px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-sm font-medium tracking-wide uppercase mb-4">
          Featured Campaigns
        </span>
        <h2 className="text-2xl md:text-3xl font-semibold">
          Back a Founder Today
        </h2>
        <p className="text-default-500 mt-2 max-w-xl mx-auto">
          Support early-stage founders building the next wave of great companies
          in Calgary.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {featured.map((founder, index) => {
          const goalCents = founder.fundraisingGoal
            ? founder.fundraisingGoal * 100
            : 0;
          const raisedCents = founder.investment?.received
            ? (founder.investment.amount ?? 0) * 100
            : 0;
          const progress =
            goalCents > 0
              ? Math.min(Math.round((raisedCents / goalCents) * 100), 100)
              : 0;
          const isFunded = founder.investment?.received;

          return (
            <div
              key={`${founder.eventId}-${index}`}
              className={`group relative block p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                isFunded
                  ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50"
                  : "border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 hover:border-violet-500/50"
              }`}
            >
              {isFunded && (
                <div className="absolute -top-2 -right-2 px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-lg">
                  Funded
                </div>
              )}

              <Link
                href={getPublicFounderProfileHref(founder.company)}
                aria-label={`View ${founder.name} profile`}
                className="flex items-start gap-4 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {founder.photo ? (
                  <img
                    src={founder.photo}
                    alt={founder.name}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 ${
                      isFunded
                        ? "bg-gradient-to-br from-green-500 to-emerald-600"
                        : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                    }`}
                  >
                    {founder.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold group-hover:text-violet-400 transition-colors">
                    {founder.name}
                  </h3>
                  <p className="text-violet-500 text-sm font-medium">
                    {founder.company}
                  </p>
                  {founder.pitchTitle && (
                    <p className="text-sm text-default-500 mt-1 line-clamp-2">
                      {founder.pitchTitle}
                    </p>
                  )}
                </div>
              </Link>

              {/* Funding progress */}
              {founder.fundraisingGoal && founder.fundraisingGoal > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-default-400">
                      {isFunded
                        ? formatCurrency(founder.investment?.amount ?? 0)
                        : "$0"}{" "}
                      raised
                    </span>
                    <span className="font-medium text-violet-500">
                      {formatCurrency(founder.fundraisingGoal)} goal
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-default-200 dark:bg-default-100/20 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFunded
                          ? "bg-green-500"
                          : "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={getPublicFounderProfileHref(founder.company)}
                  className="text-sm font-medium text-violet-500 transition-colors hover:text-violet-400"
                >
                  View Profile
                </Link>
                <Link
                  href={`/public/events/${founder.eventId}`}
                  className="text-xs text-default-400 transition-colors hover:text-violet-500"
                >
                  Event Details
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/public/portfolio"
          className="text-violet-500 hover:text-violet-400 font-medium transition-colors"
        >
          View All Founders →
        </Link>
      </div>
    </section>
  );
}
