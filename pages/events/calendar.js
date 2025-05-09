import { useState } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import events from "@/data/events.json";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { parseEventDate } from "@/utils/filterevents"; // Ensure this is imported for date parsing

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Match events to the selected date
  const eventsForDate = events.filter((event) => {
    return parseEventDate(event.date).toDateString() === selectedDate.toDateString();
  });

  // Highlight days that have events
  const tileClassName = ({ date, view }) => {
    const dateStr = date.toDateString();
    const eventsOnThisDate = events.filter((event) =>
      parseEventDate(event.date).toDateString() === dateStr
    );
    if (eventsOnThisDate.length > 0) {
      return 'highlight-event'; // Custom class for days with events
    }
    return null;
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
          tileClassName={tileClassName} // Highlight days with events
        />

        <h2 className="text-xl font-semibold mb-4">
          Events on {selectedDate.toDateString()}
        </h2>

        {eventsForDate.length > 0 ? (
          <ul className="space-y-4">
            {eventsForDate.map((event) => (
              <li key={event.id} className="border p-4 rounded shadow-sm">
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
