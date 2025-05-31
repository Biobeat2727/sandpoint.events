import EventCard from "@/components/EventCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import client from "@/lib/sanity";
import { getUpcomingEvents } from "@/utils/filterevents";  // Keeps your date filtering

const query = `*[_type == "event"]{
  _id,
  title,
  "slug": slug.current,
  date,
  description,
  "imageUrl": image.asset->url,
  venue->{
    name,
    address,
    "imageUrl": image.asset->url
  }
} | order(date asc)`;

export default function AllEventsPage({ events }) {
  const sortedEvents = getUpcomingEvents(events);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 pt-28 pb-12 max-w-5xl mx-auto">

  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
    <h1 className="text-4xl font-bold">All Events</h1>

    <Link
      href="/events/calendar"
      className="mt-4 sm:mt-0 inline-flex items-center justify-center bg-green-700 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-full text-base sm:text-lg font-medium hover:bg-green-800 transition w-full sm:w-auto text-center"


    >
      📅 View Calendar
    </Link>
  </div>

  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {sortedEvents.map((event) => (
      <EventCard key={event._id} event={event} />
    ))}
  </div>
</main>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const events = await client.fetch(query);

  return {
    props: { events },
    revalidate: 60
  };
}
