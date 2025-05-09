import events from "../../data/events.json";
import EventCard from "../../components/EventCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { getUpcomingEvents } from "@/utils/filterevents";  // Import the helper function

export default function AllEventsPage() {
  // Get only upcoming events, sorted by date
  const sortedEvents = getUpcomingEvents(events);  // This filters out past events and sorts them

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">All Events</h1>
        
        {/* Link to Calendar View */}
        <Link href="/events/calendar" className="hover:underline">
          Calendar View
        </Link>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Render each event card */}
          {sortedEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
