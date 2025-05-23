import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import venues from "../../data/venues.json";
import Footer from "@/components/Footer";


export default function VenueDetailPage() {
  const router = useRouter();
  const { slug } = router.query;

  if (!slug) {
    return (
        <>
        <Navbar />
        <main className="p-6 text-gray-600">Loading...</main>
        </>
    )
  }

  const venue = venues.find((v) => v.slug === slug);

  if (!venue) {
    return (
        <>
        <Navbar />
        <main className="p-6 text-red-600">Venue not found</main>
        </>
    );
  }

  const venueEvents = events.filter((event) => event.venueSlug === slug);


  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12">
  <div className="max-w-3xl mx-auto text-center">
    <h1 className="text-4xl font-bold mb-2">{venue?.name || slug}</h1>

    {venue?.imageUrl && (
      <img
        src={venue.imageUrl}
        alt={venue.name}
        className="w-full h-full object-contain"
      />
    )}

    <section className="mt-10 text-left">
        <h1 className="text-2xl font-semibold mb-4">Overview:</h1>
        <h2 className="text-lg text-black mb-4"> {venue?.overview || slug}</h2>
    </section>

    <section className="mt-10 text-left">
      <h2 className="text-2xl font-semibold mb-4">Upcoming Events at {venue?.name || slug}</h2>

      {venueEvents.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {venueEvents.map((event) => (
            <div key={event.id} className="bg-gray-100 rounded p-4 shadow-sm">
              <h3 className="text-lg font-semibold">{event.title}</h3>
              <p className="text-sm text-gray-500 mb-2">{event.date}</p>
              <p className="text-sm text-gray-700 mb-4">{event.description}</p>
              <a
                href={`/events/${event.slug}`}
                className="text-green-700 font-semibold hover:underline"
              >
                View Details →
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 italic">No upcoming events listed for this venue.</p>
      )}
    </section>
  </div>
</main>


      <Footer />
    </>
  );
}
