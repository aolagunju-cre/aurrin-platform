"use client";

import { useState } from "react";
import eventsData from "@/public/events.json";
import { AurrinEvent, Founder } from "@/src/types";
import Link from "next/link";
import { siteConfig } from "@/src/config/site";

interface FounderWithEvent extends Founder {
  eventId: string;
  eventTitle: string;
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

export default function PortfolioPage() {
  const pastEvents = (eventsData.events as AurrinEvent[])
    .filter((e) => e.status === "past")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [selectedEvent, setSelectedEvent] = useState<string>("all");

  const allFounders: FounderWithEvent[] = [];

  (eventsData.events as AurrinEvent[]).forEach((event) => {
    if (event.status === "past" && event.founders) {
      event.founders.forEach((founder) => {
        if (founder.name !== "Founder Name") {
          allFounders.push({
            ...founder,
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
          });
        }
      });
    }
  });

  allFounders.sort((a, b) => {
    const aInvested = a.investment?.received ? 1 : 0;
    const bInvested = b.investment?.received ? 1 : 0;
    if (bInvested !== aInvested) return bInvested - aInvested;
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  });

  const filteredFounders = selectedEvent === "all"
    ? allFounders
    : allFounders.filter((f) => f.eventId === selectedEvent);

  const investedFounders = allFounders.filter((f) => f.investment?.received);
  const totalInvested = investedFounders.reduce(
    (sum, f) => sum + (f.investment?.amount || 0),
    0
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const formatEventLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div>
      <section className="flex flex-col items-center justify-center gap-4 pb-8">
        <div className="inline-block max-w-2xl text-center justify-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Portfolio</h1>
          <p className="text-lg text-default-500 mt-4">
            Meet the founders we have backed and those who have pitched at our events, and who are building the next wave of great companies.
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mb-10 p-6 md:p-8 rounded-2xl bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 border border-violet-500/20 text-center">
        <h2 className="text-xl font-semibold mb-2">Want to join our portfolio?</h2>
        <p className="text-default-500 mb-4">
          Pitch your idea at our next event for a chance to receive funding.
        </p>
        <a
          href={siteConfig.links.pitchSignup}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
        >
          Apply to Pitch
        </a>
      </section>

      {/* Tips Link */}
      <section className="mb-10 max-w-4xl mx-auto text-center">
        <Link
          href="/public/pitch-tips"
          className="inline-block text-violet-500 hover:text-violet-400 font-medium transition-colors"
        >
          Tips for Your Next Pitch →
        </Link>
        <p className="text-default-500 text-sm mt-1">How to prepare for pitch night</p>
      </section>

      {/* Stats Section */}
      {allFounders.length > 0 && (
        <section className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 rounded-2xl bg-default-50 dark:bg-default-50/5 border border-default-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-violet-500">{allFounders.length}</div>
            <div className="text-sm text-default-500">Founders Pitched</div>
          </div>
          <div className="text-center p-6 rounded-2xl bg-default-50 dark:bg-default-50/5 border border-default-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-green-500">{investedFounders.length}</div>
            <div className="text-sm text-default-500">Investments Made</div>
          </div>
          <div className="text-center p-6 rounded-2xl bg-default-50 dark:bg-default-50/5 border border-default-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-green-500">
              {totalInvested > 0 ? formatCurrency(totalInvested) : "$0"}
            </div>
            <div className="text-sm text-default-500">Total Invested</div>
          </div>
          <div className="text-center p-6 rounded-2xl bg-default-50 dark:bg-default-50/5 border border-default-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-violet-500">{pastEvents.length}</div>
            <div className="text-sm text-default-500">Events Held</div>
          </div>
        </section>
      )}

      {/* Event Filter */}
      {allFounders.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => setSelectedEvent("all")}
            className={`px-4 py-2 rounded-full border transition-colors duration-200 ${
              selectedEvent === "all"
                ? "bg-violet-600 text-white border-violet-600 dark:bg-violet-500"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-violet-100 dark:hover:bg-violet-400 border-transparent"
            }`}
          >
            All Events
          </button>
          {pastEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event.id)}
              className={`px-4 py-2 rounded-full border transition-colors duration-200 ${
                selectedEvent === event.id
                  ? "bg-violet-600 text-white border-violet-600 dark:bg-violet-500"
                  : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-violet-100 dark:hover:bg-violet-400 border-transparent"
              }`}
            >
              {formatEventLabel(event.date)}
            </button>
          ))}
        </div>
      )}

      {/* Founders Grid */}
      {filteredFounders.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFounders.map((founder, index) => (
            <div
              key={`${founder.eventId}-${index}`}
              className={`group relative p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                founder.investment?.received
                  ? "border-green-500/30 bg-green-500/5 dark:bg-green-500/5 hover:border-green-500/50"
                  : "border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 hover:border-violet-500/50"
              }`}
            >
              {founder.investment?.received && (
                <div className="absolute -top-2 -right-2 px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-lg">
                  Funded
                </div>
              )}

              <div className="flex items-start gap-4">
                {founder.photo ? (
                  <img
                    src={founder.photo}
                    alt={founder.name}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-semibold flex-shrink-0 ${
                    founder.investment?.received
                      ? "bg-gradient-to-br from-green-500 to-emerald-600"
                      : "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                  }`}>
                    {founder.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{founder.name}</h3>
                  <p className="text-violet-500 text-sm font-medium">{founder.company}</p>
                  {founder.pitchTitle && (
                    <p className="text-sm text-default-500 mt-1 line-clamp-2">{founder.pitchTitle}</p>
                  )}
                </div>
              </div>

              {founder.fundraisingGoal && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-default-400">Fundraising Goal</span>
                  <span className="font-semibold text-violet-500">{formatCurrency(founder.fundraisingGoal)}</span>
                </div>
              )}

              {founder.investment?.received && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Investment Received
                    </span>
                    {founder.investment.amount && (
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(founder.investment.amount)}
                      </span>
                    )}
                  </div>
                  {founder.investment.notes && (
                    <p className="text-xs text-default-500 mt-1">{founder.investment.notes}</p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-default-200 dark:border-gray-700 flex items-center justify-between">
                <Link
                  href={`/public/events/${founder.eventId}`}
                  className="text-xs text-default-400 hover:text-violet-500 transition-colors"
                >
                  {formatDate(founder.eventDate)}
                </Link>
                {founder.linkedIn && (
                  <a
                    href={founder.linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-default-400 hover:text-violet-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
          <p className="text-default-500 max-w-md mx-auto">
            Our portfolio companies will be featured here. Check back
            after our next pitch night!
          </p>
        </div>
      )}
    </div>
  );
}
