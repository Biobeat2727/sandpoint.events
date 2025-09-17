import EventCard from "@/components/EventCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import client from "@/lib/sanity";
import { getUpcomingEvents } from "@/utils/filterevents";
import { useState } from "react";

export default function AllEventsPage({ events }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTags, setActiveTags] = useState([]);

  const sortedEvents = getUpcomingEvents(events);

  const allTags = Array.from(
    new Set(events.flatMap((event) => event.tags || []))
  );

  const handleTagToggle = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const filteredEvents = sortedEvents.filter((event) => {
    const term = searchTerm.toLowerCase();

    const matchesText =
      event.title.toLowerCase().includes(term) ||
      event.description?.toLowerCase().includes(term) ||
      event.tags?.some((tag) => tag.toLowerCase().includes(term));

    const matchesTags =
      activeTags.length === 0 ||
      (event.tags && activeTags.every((tag) => event.tags.includes(tag)));

    return matchesText && matchesTags;
  });

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-24 pb-16">
        {/* Page Header */}
        <section className="section-padding bg-gradient-to-r from-brand-600 to-brand-700 text-white">
          <div className="container-responsive">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="animate-fade-in">
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                  All Events
                </h1>
                <p className="text-lg text-brand-100 max-w-2xl">
                  Discover amazing events happening in and around Sandpoint. Filter by category or search to find exactly what you're looking for.
                </p>
              </div>
              <div className="flex-shrink-0 animate-slide-up">
                <Link
                  href="/events/calendar"
                  className="btn bg-white text-brand-600 hover:bg-brand-50 text-lg px-8 py-4 shadow-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  View Calendar
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="section-padding bg-white border-b border-neutral-200">
          <div className="container-responsive">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search events by title, description, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10 text-base h-12 shadow-soft"
                />
              </div>

              {/* Filter Tags */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Filter by Category
                  </h3>
                  {activeTags.length > 0 && (
                    <button
                      onClick={() => setActiveTags([])}
                      className="text-sm text-neutral-500 hover:text-brand-600 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear All Filters
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const isActive = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        className={`tag tag-interactive ${
                          isActive ? "tag-primary" : "tag-secondary"
                        } transition-all duration-200`}
                      >
                        {tag}
                        {isActive && (
                          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Results Summary */}
                <div className="text-sm text-neutral-600 pt-2">
                  {filteredEvents.length === sortedEvents.length ? (
                    <span>Showing all {filteredEvents.length} events</span>
                  ) : (
                    <span>
                      Showing {filteredEvents.length} of {sortedEvents.length} events
                      {searchTerm && (
                        <span> matching "{searchTerm}"</span>
                      )}
                      {activeTags.length > 0 && (
                        <span> in {activeTags.join(", ")}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Events Grid */}
        <section className="section-padding">
          <div className="container-responsive">
            {filteredEvents.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredEvents.map((event, index) => (
                  <div key={event._id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                    <EventCard event={event} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 bg-neutral-100 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  No Events Found
                </h3>
                <p className="text-neutral-600 mb-6 max-w-md mx-auto">
                  {searchTerm || activeTags.length > 0
                    ? "Try adjusting your search or filters to find more events."
                    : "There are no events available at the moment. Check back soon!"}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {(searchTerm || activeTags.length > 0) && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setActiveTags([]);
                      }}
                      className="btn btn-outline"
                    >
                      Clear All Filters
                    </button>
                  )}
                  <Link href="/venues" className="btn btn-primary">
                    Browse Venues
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// Fetch events from Sanity
const query = `*[_type == "event" && published == true]{
  _id,
  title,
  "slug": slug.current,
  date,
  description,
  tags,
  url,
  "imageUrl": image.asset->url,
  venue->{
    name,
    address,
    "imageUrl": image.asset->url
  }
} | order(date asc)`;

export async function getStaticProps() {
  const events = await client.fetch(query);

  return {
    props: { events },
    revalidate: 60,
  };
}
