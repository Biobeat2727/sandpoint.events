import { useState } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import client from "@/lib/sanity";

export default function CalendarPage({ events }) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const eventsForDate = events.filter((event) =>
    new Date(event.date).toDateString() === selectedDate.toDateString()
  );

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const hasEvent = events.some(event =>
        new Date(event.date).toDateString() === date.toDateString()
      );
      return hasEvent ? 'highlight-event' : null;
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-4xl mx-auto px-4 py-10 text-gray-800">
        <h1 className="text-3xl font-bold mb-6">Event Calendar</h1>

        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          className="mb-10 rounded shadow-md"
          tileClassName={tileClassName}
        />

        <h2 className="text-xl font-semibold mb-4">
          Events on {selectedDate.toDateString()}
        </h2>

        {eventsForDate.length > 0 ? (
          <ul className="space-y-4">
            {eventsForDate.map((event) => (
              <li key={event._id} className="border p-4 rounded shadow-sm">
                <h3 className="text-lg font-bold">{event.title}</h3>
                <p className="text-sm">{event.description}</p>
                <a
                  href={`/events/${event.slug}`}
                  className="text-green-700 hover:underline text-sm"
                >
                  View Details →
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-gray-500">No events for this day.</p>
        )}
      </main>
      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const query = `*[_type == "event"]{
    _id,
    title,
    "slug": slug.current,
    date,
    description
  }`;

  const events = await client.fetch(query);

  return {
    props: { events },
    revalidate: 60
  };
}
