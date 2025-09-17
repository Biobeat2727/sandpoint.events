import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { getGoogleCalendarUrl } from "@/lib/canlendarUtils";
import { formatDate, formatDateRange, formatTimeRange } from "@/utils/formatDate";

const query = `*[_type == "event" && slug.current == $slug && published == true][0]{
  _id,
  title,
  "slug": slug.current,
  date,
  startDate,
  endDate,
  startTime,
  endTime,
  description,
  tags,
  url,
  tickets,
  referenceUrl,
  locationNote,
  "imageUrl": image.asset->url,
  venue->{
    name,
    address,
    phone,
    website,
    "imageUrl": image.asset->url,
    slug
  }
}`;

const relatedQuery = `*[
  _type == "event" &&
  slug.current != $slug &&
  published == true &&
  dateTime(date) >= dateTime(now())
] | order(date asc)[0...3]{
  _id,
  title,
  "slug": slug.current,
  date
}`;


export default function EventDetailPage({ event, relatedEvents }) {
  const venue = event.venue;

  // Enhanced date/time formatting using utility functions
  const getDateDisplay = () => {
    if (event.startDate) {
      return formatDateRange(event.startDate, event.endDate);
    }
    // Fallback to legacy date field
    if (event.date) {
      return formatDate(event.date);
    }
    return 'Date TBD';
  };

  const getTimeDisplay = () => {
    if (event.startTime || event.endTime) {
      return formatTimeRange(event.startTime, event.endTime);
    }
    return '';
  };

  const calculateDuration = () => {
    const startTime = event.startTime;
    const endTime = event.endTime;

    if (!startTime || !endTime) return null;

    // Parse time strings (assuming format like "14:00" or "2:00 PM")
    const parseTime = (timeStr) => {
      const time = timeStr.toLowerCase();
      const [timePart, period] = time.split(/\s+/);
      const [hours, minutes] = timePart.split(':').map(Number);

      let hour24 = hours;
      if (period === 'pm' && hours !== 12) hour24 += 12;
      if (period === 'am' && hours === 12) hour24 = 0;

      return hour24 * 60 + (minutes || 0);
    };

    try {
      const startMinutes = parseTime(startTime);
      const endMinutes = parseTime(endTime);
      const duration = endMinutes - startMinutes;

      if (duration > 0) {
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;

        if (hours > 0 && mins > 0) {
          return `${hours}h ${mins}m`;
        } else if (hours > 0) {
          return `${hours}h`;
        } else {
          return `${mins}m`;
        }
      }
    } catch (e) {
      // Fallback for time parsing errors
    }

    return null;
  };

  const duration = calculateDuration();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50">
        {/* Hero Section */}
        <div className="relative">
          {event.imageUrl ? (
            <div className="relative h-[60vh] min-h-[400px] max-h-[600px] overflow-hidden">
              <img
                src={event.imageUrl}
                alt={`Event image for ${event.title}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* Hero Content Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12 text-white">
                <div className="container-responsive">
                  <div className="max-w-4xl">
                    {/* Event Tags */}
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {event.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm text-white border border-white/30"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 text-balance leading-tight">
                      {event.title}
                    </h1>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-lg">
                      {/* Date */}
                      <div className="flex items-center text-white/90">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">{getDateDisplay()}</span>
                      </div>

                      {/* Time */}
                      {getTimeDisplay() && (
                        <>
                          <span className="hidden sm:block text-white/60">•</span>
                          <div className="flex items-center text-white/90">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{getTimeDisplay()}</span>
                            {duration && (
                              <span className="ml-2 text-sm text-white/70">({duration})</span>
                            )}
                          </div>
                        </>
                      )}

                      {/* Venue */}
                      {venue?.name && (
                        <>
                          <span className="hidden sm:block text-white/60">•</span>
                          <div className="flex items-center text-white/90">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{venue.name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback Hero without Image */
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <div className="container-responsive section-padding">
                <div className="max-w-4xl">
                  {/* Event Tags */}
                  {event.tags && event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {event.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="tag bg-white/20 backdrop-blur-sm text-white border border-white/30"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight">
                    {event.title}
                  </h1>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-lg">
                    {/* Date */}
                    <div className="flex items-center text-white/90">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">{getDateDisplay()}</span>
                    </div>

                    {/* Time */}
                    {getTimeDisplay() && (
                      <>
                        <span className="hidden sm:block text-white/60">•</span>
                        <div className="flex items-center text-white/90">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{getTimeDisplay()}</span>
                          {duration && (
                            <span className="ml-2 text-sm text-white/70">({duration})</span>
                          )}
                        </div>
                      </>
                    )}

                    {/* Venue */}
                    {venue?.name && (
                      <>
                        <span className="hidden sm:block text-white/60">•</span>
                        <div className="flex items-center text-white/90">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{venue.name}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="container-responsive py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">

              {/* Event Description */}
              <section className="card animate-fade-in">
                <div className="card-header">
                  <h2 className="text-2xl font-semibold text-neutral-900">About This Event</h2>
                </div>
                <div className="card-body">
                  <div className="prose-responsive">
                    <p className="text-lg text-neutral-700 leading-relaxed">{event.description}</p>
                  </div>
                </div>
              </section>

              {/* Event Tags */}
              {event.tags && event.tags.length > 3 && (
                <section className="card animate-fade-in">
                  <div className="card-header">
                    <h3 className="text-xl font-semibold text-neutral-900">Event Categories</h3>
                  </div>
                  <div className="card-body">
                    <div className="flex flex-wrap gap-3">
                      {event.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="tag tag-primary tag-interactive"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-6 lg:sticky lg:top-8">
              {/* Venue Information Card */}
              {venue ? (
                <div className="card animate-slide-up">
                  {venue?.imageUrl && (
                    <div className="relative h-48 overflow-hidden rounded-t-xl">
                      <img
                        src={venue.imageUrl}
                        alt={venue.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  )}

                  <div className="card-body">
                    <h3 className="text-xl font-semibold text-neutral-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Venue
                    </h3>

                    {venue?.slug?.current ? (
                      <Link
                        href={`/venues/${venue.slug.current}`}
                        className="text-xl font-semibold text-brand-600 hover:text-brand-700 transition-colors block mb-3 hover:underline"
                      >
                        {venue.name}
                      </Link>
                    ) : (
                      <h4 className="text-xl font-semibold text-neutral-900 mb-3">{venue.name}</h4>
                    )}

                    <div className="space-y-3">
                      {venue.address && (
                        <div className="flex items-start text-neutral-600">
                          <svg className="w-4 h-4 mr-3 mt-1 text-neutral-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm">{venue.address}</span>
                        </div>
                      )}

                      {venue.phone && (
                        <div className="flex items-center text-neutral-600">
                          <svg className="w-4 h-4 mr-3 text-neutral-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <a href={`tel:${venue.phone}`} className="text-sm text-brand-600 hover:text-brand-700 transition-colors">
                            {venue.phone}
                          </a>
                        </div>
                      )}

                      {venue.website && (
                        <div className="flex items-center text-neutral-600">
                          <svg className="w-4 h-4 mr-3 text-neutral-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                          </svg>
                          <a
                            href={venue.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-brand-600 hover:text-brand-700 transition-colors flex items-center"
                          >
                            Visit Website
                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : event.locationNote ? (
                <div className="card animate-slide-up">
                  <div className="card-body">
                    <h3 className="text-xl font-semibold text-neutral-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Location
                    </h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 mr-2 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <p className="text-amber-800 font-medium text-sm">Location Note</p>
                          <p className="text-amber-700 text-sm mt-1">{event.locationNote}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card animate-slide-up">
                  <div className="card-body text-center">
                    <h3 className="text-xl font-semibold text-neutral-900 mb-4">Location</h3>
                    <div className="text-neutral-500">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm italic">Location details to be announced</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons Card */}
              <div className="card animate-slide-up">
                <div className="card-body space-y-4">
                  {/* Add to Calendar */}
                  {(event.date || event.startDate) && (
                    <a
                      href={getGoogleCalendarUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary w-full group/btn"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>Add to Calendar</span>
                      <svg className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}

                  {/* Get Tickets */}
                  {event.tickets && (
                    <a
                      href={event.tickets}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary w-full group/btn"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 11-4 0V7a2 2 0 00-2-2H5z" />
                      </svg>
                      <span>Get Tickets</span>
                      <svg className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}

                  {/* Event Website Link */}
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline w-full group/btn"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                      </svg>
                      <span>Event Website</span>
                      <svg className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}

                  {/* Reference URL - View Original Event */}
                  {event.referenceUrl && (
                    <a
                      href={event.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-sm text-neutral-500 hover:text-brand-600 transition-colors flex items-center justify-center group/link"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span>View Original Source</span>
                      <svg className="w-3 h-3 ml-1 transition-transform group-hover/link:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Related Events */}
        {relatedEvents && relatedEvents.length > 0 && (
          <section className="bg-white border-t border-neutral-200">
            <div className="container-responsive section-padding">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-neutral-900 mb-4">You Might Also Like</h2>
                <p className="text-neutral-600 max-w-2xl mx-auto">Discover more exciting events happening in Sandpoint</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {relatedEvents.map((related, index) => (
                  <article
                    key={related._id}
                    className="card-interactive animate-scale-in group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="card-body">
                      <h3 className="text-lg font-semibold text-neutral-900 mb-3 line-clamp-2 group-hover:text-brand-600 transition-colors">
                        {related.title}
                      </h3>

                      <div className="flex items-center text-sm text-neutral-500 mb-4">
                        <svg className="w-4 h-4 mr-2 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">
                          {new Date(related.date).toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric"
                          })}
                        </span>
                      </div>

                      <Link
                        href={`/events/${related.slug}`}
                        className="btn btn-primary w-full group/btn"
                        aria-label={`View details for ${related.title}`}
                      >
                        <span>View Details</span>
                        <svg className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}


export async function getStaticPaths() {
  // Generate paths for the most recent published events to improve initial load performance
  const slugs = await client.fetch(`*[_type == "event" && published == true] | order(_createdAt desc)[0...50]{ "slug": slug.current }`);

  return {
    paths: slugs.map(({ slug }) => ({ params: { slug } })),
    fallback: 'blocking' // Enable ISR for new events
  };
}

export async function getStaticProps({ params }) {
  const event = await client.fetch(query, { slug: params.slug });

  // Return 404 if event not found or not published
  if (!event) {
    return {
      notFound: true,
    };
  }

  const relatedEvents = await client.fetch(relatedQuery, { slug: params.slug });

  return {
    props: { event, relatedEvents },
    revalidate: 60 // Revalidate every minute
  };
}
