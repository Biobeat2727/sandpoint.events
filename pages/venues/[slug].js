import { useRouter } from "next/router";
import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { formatDateRange, formatTimeRange } from "@/utils/formatDate";

// Sanity queries
const venueQuery = `*[_type == "venue" && slug.current == $slug][0]{
  _id,
  name,
  address,
  phone,
  website,
  email,
  "slug": slug.current,
  "imageUrl": image.asset->url,
  overview
}`;

const eventsQuery = `*[_type == "event" && venue->slug.current == $slug && published == true] | order(coalesce(startDate, date) asc){
  _id,
  title,
  date,
  startDate,
  endDate,
  startTime,
  endTime,
  description,
  locationNote,
  referenceUrl,
  "slug": slug.current,
  "imageUrl": image.asset->url,
  venue->{
    name,
    "slug": slug.current
  }
}`;

// Generate static paths
export async function getStaticPaths() {
  const slugs = await client.fetch(`*[_type == "venue"]{ "slug": slug.current }`);
  const paths = slugs.map((slugObj) => ({
    params: { slug: slugObj.slug },
  }));

  return {
    paths,
    fallback: 'blocking' // Enable ISR for new venues
  };
}

// Fetch data
export async function getStaticProps({ params }) {
  const venue = await client.fetch(venueQuery, { slug: params.slug });
  const venueEvents = await client.fetch(eventsQuery, { slug: params.slug });

  return {
    props: {
      venue,
      venueEvents,
    },
    revalidate: 60,
  };
}

// Component
export default function VenueDetailPage({ venue, venueEvents }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50">
        {/* Hero Section */}
        <div className="relative">
          {venue.imageUrl ? (
            <div className="relative h-[50vh] min-h-[300px] max-h-[500px] overflow-hidden">
              <img
                src={venue.imageUrl}
                alt={venue.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* Hero Content Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12 text-white">
                <div className="container-responsive">
                  <div className="max-w-4xl">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 text-balance leading-tight">
                      {venue.name}
                    </h1>

                    {venue.address && (
                      <div className="flex items-center text-white/90 text-lg">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{venue.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback Hero without Image */
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <div className="container-responsive section-padding">
                <div className="max-w-4xl text-center">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight">
                    {venue.name}
                  </h1>

                  {venue.address && (
                    <div className="flex items-center justify-center text-white/90 text-lg">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{venue.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>


        {/* Main Content */}
        <div className="container-responsive py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Overview Section */}
            <div className="lg:col-span-2 space-y-8">
              <motion.div
                className="card animate-fade-in"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="card-header">
                  <h2 className="text-2xl font-semibold text-neutral-900">About {venue.name}</h2>
                </div>
                <div className="card-body">
                  <div className="prose-responsive">
                    <p className="text-lg text-neutral-700 leading-relaxed">
                      {venue.overview || "Discover this unique venue in the heart of Sandpoint. More details about this location will be added soon."}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Contact Information Sidebar */}
            <div className="space-y-6">
              <motion.div
                className="card animate-slide-up lg:sticky lg:top-8"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="card-header">
                  <h3 className="text-xl font-semibold text-neutral-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Contact Information
                  </h3>
                </div>
                <div className="card-body space-y-6">
                  {/* Address */}
                  {venue.address && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
                        <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 mb-1">Address</p>
                        <p className="text-neutral-600 text-sm leading-relaxed">{venue.address}</p>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {venue.phone && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
                        <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 mb-1">Phone</p>
                        <a href={`tel:${venue.phone}`} className="text-brand-600 hover:text-brand-700 hover:underline transition-colors text-sm">
                          {venue.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {venue.email && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
                        <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 mb-1">Email</p>
                        <a href={`mailto:${venue.email}`} className="text-brand-600 hover:text-brand-700 hover:underline transition-colors text-sm break-all">
                          {venue.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Website */}
                  {venue.website && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
                        <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900 mb-1">Website</p>
                        <a
                          href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-700 transition-colors text-sm flex items-center group"
                        >
                          <span>Visit Website</span>
                          <svg className="w-3 h-3 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* No contact info message */}
                  {!venue.address && !venue.phone && !venue.email && !venue.website && (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-neutral-500 text-sm italic">
                        Contact information not available.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Events Section */}
        <section className="bg-white border-t border-neutral-200">
          <div className="container-responsive section-padding">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-neutral-900 mb-4">
                Upcoming Events at {venue.name}
              </h2>
              <p className="text-neutral-600 max-w-2xl mx-auto">
                Discover exciting events happening at this venue
              </p>
            </div>

            {venueEvents.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {venueEvents.map((event, index) => {
                  // Format date display with backward compatibility
                  const getDateDisplay = () => {
                    if (event.startDate) {
                      return formatDateRange(event.startDate, event.endDate);
                    }
                    // Fallback to legacy date field
                    if (event.date) {
                      const date = new Date(event.date);
                      return date.toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    }
                    return 'Date TBD';
                  };

                  // Format time display
                  const getTimeDisplay = () => {
                    if (event.startTime || event.endTime) {
                      return formatTimeRange(event.startTime, event.endTime);
                    }
                    return '';
                  };

                  return (
                    <motion.div
                      key={event._id}
                      className="card-interactive group animate-scale-in"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 100 }}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Event Image */}
                      <div className="relative overflow-hidden">
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
                      </div>

                      <div className="event-content">
                        {/* Event Title */}
                        <h3 className="event-title">
                          {event.title}
                        </h3>

                        {/* Event Meta Information */}
                        <div className="space-y-2">
                          {/* Date */}
                          <div className="event-meta">
                            <svg className="w-4 h-4 mr-2 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">{getDateDisplay()}</span>
                          </div>

                          {/* Time */}
                          {getTimeDisplay() && (
                            <div className="event-meta">
                              <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{getTimeDisplay()}</span>
                            </div>
                          )}

                          {/* Location Note (if provided) */}
                          {event.locationNote && (
                            <div className="event-meta text-amber-600">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{event.locationNote}</span>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {event.description && (
                          <p className="event-description">
                            {event.description}
                          </p>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col space-y-3 pt-4">
                          {/* Main CTA */}
                          <a
                            href={`/events/${event.slug}`}
                            className="btn btn-primary w-full group/btn"
                          >
                            <span>View Details</span>
                            <svg className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </a>

                          {/* Reference URL link */}
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
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <motion.div
                className="text-center py-16"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="w-24 h-24 mx-auto mb-6 bg-neutral-100 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  No upcoming events scheduled
                </h3>
                <p className="text-neutral-500 max-w-md mx-auto">
                  Events at {venue.name} will appear here when they're added. Check back soon for exciting upcoming events!
                </p>
              </motion.div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
