import { useRouter } from "next/router";
import Link from "next/link";
import events from "@/data/events.json";
import venues from "@/data/venues.json";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function EventDetailPage() {
  const router = useRouter();
  const { slug } = router.query;

  if (!slug) return <div>Loading...</div>;

  const event = events.find((e) => e.slug === slug);
  if (!event) return <div>Event not found.</div>;

  const venue = venues.find((v) => v.slug === event.venueSlug);

  return (
    <>
      <Navbar />
      <main className="bg-white text-gray-900 px-4 sm:px-6 py-12 max-w-6xl mx-auto">
        {/* Hero Image */}
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-80 object-cover rounded-lg mb-10"
          />
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="md:col-span-2">
            <h1 className="text-4xl font-bold mb-2">{event.title}</h1>
            <p className="text-gray-500 text-sm mb-4">
              {new Date(event.date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            {/* Tags Placeholder */}
            <div className="mb-4">
              <span className="text-xs bg-gray-200 text-gray-800 px-3 py-1 rounded-full mr-2">
                Community
              </span>
              <span className="text-xs bg-gray-200 text-gray-800 px-3 py-1 rounded-full">
                Local
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Main Info</h2>
              <p className="text-gray-700">{event.description}</p>
              <p className="mt-4 italic text-sm">
                Presented by <span className="text-gray-600">Organizer Name</span>
              </p>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Location</h2>
              <p className="text-gray-800">{venue?.name}</p>
              <p className="text-gray-600">{venue?.address}</p>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {venue?.imageUrl && (
              <img
                src={venue.imageUrl}
                alt={venue.name}
                className="w-full rounded-lg shadow"
              />
            )}
            <div>
              <p className="font-semibold text-lg">{venue?.name}</p>
              <p className="text-sm text-gray-600">{venue?.address}</p>
            </div>
            <button className="w-full bg-green-700 text-white py-2 rounded hover:bg-green-800">
              Add to Calendar
            </button>
            <button className="w-full border border-green-700 text-green-700 py-2 rounded hover:bg-green-50">
              Get Tickets
            </button>
          </aside>
        </div>

        {/* Related Events (placeholder) */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Related Events</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {events
              .filter((e) => e.slug !== event.slug)
              .slice(0, 3)
              .map((related) => (
                <div key={related.id} className="bg-gray-100 p-4 rounded shadow-sm">
                  <h3 className="font-semibold">{related.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(related.date).toLocaleDateString()}
                  </p>
                  <Link
                    href={`/events/${related.slug}`}
                    className="text-green-700 text-sm mt-2 inline-block hover:underline"
                  >
                    View Details →
                  </Link>
                </div>
              ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
