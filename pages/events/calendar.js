import { useState } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import client from "@/lib/sanity";
import Link from "next/link";

export default function CalendarPage({ events }) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const eventsForDate = events.filter((event) =>
    new Date(event.date).toDateString() === selectedDate.toDateString()
  );

  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const hasEvent = events.some(event =>
        new Date(event.date).toDateString() === date.toDateString()
      );
      return hasEvent ? <div className="w-1 h-1 mx-auto mt-1 bg-green-500 rounded-full" /> : null;
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-900 flex flex-col items-center pt-28 pb-10 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Full Event Calendar</h1>
        <div className="w-full max-w-5xl flex flex-col md:flex-row gap-10">
          <div className="w-full md:w-1/2">
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              tileContent={tileContent}
              className="rounded-lg shadow-md border border-gray-200 w-full"
            />
          </div>

          <div className="w-full md:w-1/2">
            <h2 className="text-2xl font-semibold mb-4 text-center">
              Events on {selectedDate.toDateString()}
            </h2>

            {eventsForDate.length > 0 ? (
              <div className="space-y-6">
                {eventsForDate.map((event) => (
                  <div key={event._id} className="bg-gray-100 p-5 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-1">{event.title}</h3>
                    <p className="text-gray-700 mb-2">{event.description}</p>
                    <Link
                      href={`/events/${event.slug}`}
                      className="text-green-700 font-medium hover:underline"
                    >
                      View Details →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-center">No events for this day.</p>
            )}
          </div>
        </div>
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
