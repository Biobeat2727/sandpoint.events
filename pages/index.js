// pages/index.js

import EventCard from "@/components/EventCard";
import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroCarousel from "@/components/HeroCarousel";
import Link from "next/link";
import { getUpcomingEvents } from "@/utils/filterevents";

const eventQuery = `*[_type == "event" && published == true]{
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
} | order(date asc)`

export default function Home({ events }) {
  const upcomingEvents = getUpcomingEvents(events);

  return (
    <>
      <Navbar />

      <HeroCarousel events={events} />

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <section className="section-padding bg-gradient-to-br from-neutral-50 to-neutral-100 border-b border-neutral-200">
          <div className="container-responsive text-center">
            <div className="max-w-4xl mx-auto animate-fade-in">
              <h1 className="text-5xl md:text-6xl font-bold text-neutral-900 mb-6 text-balance">
                Discover
                <span className="text-transparent bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text"> Sandpoint </span>
                Events
              </h1>
              <p className="text-xl text-neutral-600 mb-8 text-balance max-w-2xl mx-auto leading-relaxed">
                Your premier destination for live music, community gatherings, and cultural experiences in beautiful Sandpoint, Idaho.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/events"
                  className="btn btn-primary text-lg px-8 py-4"
                >
                  Browse All Events
                </Link>
                <Link
                  href="/venues"
                  className="btn btn-secondary text-lg px-8 py-4"
                >
                  Explore Venues
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Events Section */}
        <section className="section-padding">
          <div className="container-responsive">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
                Upcoming Events
              </h2>
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                Don't miss out on the exciting events happening in and around Sandpoint
              </p>
            </div>

            {upcomingEvents.length > 0 ? (
              <>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-12">
                  {upcomingEvents.slice(0, 8).map((event, index) => (
                    <div key={event._id} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                      <EventCard event={event} />
                    </div>
                  ))}
                </div>

                {/* View All Events CTA */}
                {upcomingEvents.length > 8 && (
                  <div className="text-center">
                    <Link
                      href="/events"
                      className="btn btn-outline text-lg px-8 py-4"
                    >
                      View All {upcomingEvents.length} Events
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 bg-neutral-100 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  No Upcoming Events
                </h3>
                <p className="text-neutral-600 mb-6 max-w-md mx-auto">
                  Check back soon for new events, or browse our venues to see what's available.
                </p>
                <Link
                  href="/venues"
                  className="btn btn-primary"
                >
                  Explore Venues
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Features Section */}
        <section className="section-padding bg-neutral-900 text-white">
          <div className="container-responsive">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Choose Sandpoint.Events?
              </h2>
              <p className="text-lg text-neutral-300 max-w-2xl mx-auto">
                We're your trusted source for discovering the best of Sandpoint's vibrant culture
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center animate-slide-up">
                <div className="w-16 h-16 mx-auto mb-4 bg-brand-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3">Curated Events</h3>
                <p className="text-neutral-300 leading-relaxed">
                  Hand-picked events from trusted local sources, ensuring quality experiences every time.
                </p>
              </div>

              <div className="text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
                <div className="w-16 h-16 mx-auto mb-4 bg-brand-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3">Real-Time Updates</h3>
                <p className="text-neutral-300 leading-relaxed">
                  Always up-to-date event information so you never miss what's happening in town.
                </p>
              </div>

              <div className="text-center animate-slide-up" style={{ animationDelay: '400ms' }}>
                <div className="w-16 h-16 mx-auto mb-4 bg-brand-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3">Local Focus</h3>
                <p className="text-neutral-300 leading-relaxed">
                  Dedicated to showcasing the best of Sandpoint's local venues and community events.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const events = await client.fetch(eventQuery);

  return {
    props: { events },
    revalidate: 60
  };
}