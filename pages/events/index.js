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

        <input
          type="text"
          placeholder="Search Events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 mb-4 rounded border border-gray-300"
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagToggle(tag)}
              className={`px-3 py-1 rounded-full text-sm border ${
                activeTags.includes(tag)
                  ? "bg-green-500 text-white"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <EventCard key={event._id} event={event} />
            ))
          ) : (
            <p className="text-gray-500">No matching events found.</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

// Fetch events from Sanity
const query = `*[_type == "event"]{
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
