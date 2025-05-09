import EventCard from "../components/EventCard";
import events from "../data/events.json";
import Navbar from "../components/Navbar";
import Footer from "@/components/Footer";
import HeroCarousel from "@/components/HeroCarousel";
import { getUpcomingEvents } from "@/utils/filterevents";  // Import the helper function to filter events

const Home = () => {
  // Get the upcoming events
  const upcomingEvents = getUpcomingEvents(events);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12">
        {/* Hero Carousel */}
        <HeroCarousel />

        <h1 className="text-4xl font-bold mb-4">Sandpoint.Events</h1>
        <p className="mb-8 text-lg">
          Your home for live music, community events, and what’s happening around town.
        </p>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Upcoming Events</h2>
          {/* Grid of events */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Home;
