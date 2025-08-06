// pages/index.js

import EventCard from "@/components/EventCard";
import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroCarousel from "@/components/HeroCarousel";
import { getUpcomingEvents } from "@/utils/filterevents";

const eventQuery = `*[_type == "event"]{
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
      <Navbar /> {/* Your fixed Navbar */}
      
      <HeroCarousel events={events} /> {/* This is now absolute and full screen */}

      <main className="bg-white text-gray-800 px-6 py-12 relative z-10">
        <h1 className="text-4xl font-bold mb-4">Sandpoint.Events</h1>
        <p className="mb-8 text-lg">
          Your home for live music, community events, and what’s happening around town.
        </p>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Upcoming Events</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map(event => (
              <EventCard key={event._id} event={event} />
            ))}
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