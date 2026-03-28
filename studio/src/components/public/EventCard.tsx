import Link from "next/link";
import { AurrinEvent } from "@/src/types";

interface EventCardProps {
  event: AurrinEvent;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const eventDate = new Date(event.date + "T12:00:00");
  const isPast = event.status === "past";

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Link href={`/public/events/${event.id}`}>
      <div className="group relative overflow-hidden rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1">
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20">
          {event.coverImage && !event.coverImage.includes("cover.jpg") ? (
            <img
              src={event.coverImage}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl opacity-20">🚀</div>
            </div>
          )}
          <div className="absolute top-3 right-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isPast
                  ? "bg-default-200 dark:bg-default-100/20 text-default-600 dark:text-default-400"
                  : "bg-violet-500 text-white"
              }`}
            >
              {isPast ? "Past Event" : "Upcoming"}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 text-sm text-default-500 mb-2">
            <span>{formatDate(eventDate)}</span>
            <span>•</span>
            <span>{event.time}</span>
          </div>
          <h3 className="text-lg font-semibold mb-2 group-hover:text-violet-500 transition-colors">
            {event.title}
          </h3>
          <p className="text-sm text-default-500 line-clamp-2">
            {event.description}
          </p>

          {isPast && (event.judges.length > 0 || event.founders.length > 0) && (
            <div className="flex gap-4 mt-4 pt-4 border-t border-default-200 dark:border-gray-700">
              {event.judges.length > 0 && (
                <div className="text-sm">
                  <span className="text-default-400">Judges:</span>{" "}
                  <span className="font-medium">{event.judges.length}</span>
                </div>
              )}
              {event.founders.length > 0 && (
                <div className="text-sm">
                  <span className="text-default-400">Founders:</span>{" "}
                  <span className="font-medium">{event.founders.length}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default EventCard;
