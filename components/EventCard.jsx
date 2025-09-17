// components/EventCard.jsx

import Link from "next/link";
import { formatDate, formatDateRange, formatTimeRange } from "@/utils/formatDate";

export default function EventCard({ event }) {
  // Format date display with backward compatibility
  const getDateDisplay = () => {
    if (event.startDate) {
      return formatDateRange(event.startDate, event.endDate);
    }
    // Fallback to legacy date field
    if (event.date) {
      return formatDate(event.date);
    }
    return '';
  };

  // Format time display
  const getTimeDisplay = () => {
    if (event.startTime || event.endTime) {
      return formatTimeRange(event.startTime, event.endTime);
    }
    return '';
  };

  // Format location display
  const getLocationDisplay = () => {
    if (event.venue?.name) {
      return event.venue.name;
    }
    if (event.locationNote) {
      return event.locationNote;
    }
    return '';
  };

  return (
    <div className="event-card group animate-scale-in">
      {/* Event Image */}
      <div className="relative overflow-hidden bg-neutral-100">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="event-image"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
            <div className="text-brand-600 text-center">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Event Image</span>
            </div>
          </div>
        )}

        {/* Event Tags Overlay */}
        {event.tags && event.tags.length > 0 && (
          <div className="absolute top-3 left-3">
            <span className="tag tag-primary text-xs">
              {event.tags[0]}
            </span>
          </div>
        )}
      </div>

      {/* Event Content */}
      <div className="event-content">
        {/* Event Title */}
        <h3 className="event-title">
          {event.title}
        </h3>

        {/* Event Meta Information */}
        <div className="space-y-2">
          {/* Date */}
          {getDateDisplay() && (
            <div className="event-meta">
              <svg className="w-4 h-4 mr-2 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">{getDateDisplay()}</span>
            </div>
          )}

          {/* Time */}
          {getTimeDisplay() && (
            <div className="event-meta">
              <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{getTimeDisplay()}</span>
            </div>
          )}

          {/* Location */}
          {getLocationDisplay() && (
            <div className="event-meta">
              <svg className="w-4 h-4 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{getLocationDisplay()}</span>
            </div>
          )}
        </div>

        {/* Event Description */}
        {event.description && (
          <p className="event-description">
            {event.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3 pt-4">
          {/* Main CTA */}
          <Link
            href={`/events/${event.slug}`}
            className="btn btn-primary w-full group/btn"
          >
            <span>View Details</span>
            <svg className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Secondary Actions */}
          <div className="flex justify-between items-center">
            {/* Reference URL link */}
            {event.referenceUrl && (
              <a
                href={event.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-500 hover:text-brand-600 transition-colors flex items-center"
              >
                <span>View Source</span>
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Additional Tags */}
            {event.tags && event.tags.length > 1 && (
              <div className="flex space-x-1">
                {event.tags.slice(1, 3).map((tag, index) => (
                  <span key={index} className="tag tag-secondary text-xs">
                    {tag}
                  </span>
                ))}
                {event.tags.length > 3 && (
                  <span className="text-xs text-neutral-400">
                    +{event.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}