"use client";

import { useEffect, useState } from "react";
import EventCard from "./EventCard";
import { AurrinEvent } from "@/src/types";

interface EventsData {
  events: AurrinEvent[];
}

const EventGrid: React.FC = () => {
  const [events, setEvents] = useState<AurrinEvent[]>([]);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/events.json");
        const data: EventsData = await response.json();
        const sortedEvents = data.events.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });
        setEvents(sortedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = events.filter((event) => {
    if (filter === "all") return true;
    return event.status === filter;
  });

  const upcomingCount = events.filter((e) => e.status === "upcoming").length;
  const pastCount = events.filter((e) => e.status === "past").length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-default-500">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-3 justify-center mb-8">
        <button
          onClick={() => setFilter("all")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            filter === "all"
              ? "bg-violet-600 text-white"
              : "bg-default-100 dark:bg-default-50/10 text-default-600 dark:text-default-400 hover:bg-violet-100 dark:hover:bg-violet-500/20"
          }`}
        >
          All Events ({events.length})
        </button>
        <button
          onClick={() => setFilter("upcoming")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            filter === "upcoming"
              ? "bg-violet-600 text-white"
              : "bg-default-100 dark:bg-default-50/10 text-default-600 dark:text-default-400 hover:bg-violet-100 dark:hover:bg-violet-500/20"
          }`}
        >
          Upcoming ({upcomingCount})
        </button>
        <button
          onClick={() => setFilter("past")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            filter === "past"
              ? "bg-violet-600 text-white"
              : "bg-default-100 dark:bg-default-50/10 text-default-600 dark:text-default-400 hover:bg-violet-100 dark:hover:bg-violet-500/20"
          }`}
        >
          Past ({pastCount})
        </button>
      </div>

      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-default-500">
          No events found.
        </div>
      )}
    </div>
  );
};

export default EventGrid;
