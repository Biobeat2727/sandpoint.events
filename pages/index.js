import EventCard from "../components/EventCard";
import client from "@/lib/sanity";
import Navbar from "../components/Navbar";
import Footer from "@/components/Footer";
import HeroCarousel from "@/components/HeroCarousel";
import { getUpcomingEvents } from "@/utils/filterevents";  // Import the helper function

const eventQuery = `*[_type == "event"]{
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
} | order(date asc)`

// ✅ Accept events as a prop
export default function Home({ events }) {
  const upcomingEvents = getUpcomingEvents(events);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12">
        <HeroCarousel events={events} />

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

// ✅ Static Props
export async function getStaticProps() {
  const events = await client.fetch(eventQuery);

  return {
    props: { events },
    revalidate: 60
  };
}
