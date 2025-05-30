import { useRouter } from "next/router";
import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const venueQuery = `*[_type == "venue" && slug.current == $slug][0]{
  _id,
  name,
  address,
  "slug": slug.current,
  "imageUrl": image.asset->url,
  overview
}`;

const eventsQuery = `*[_type == "event" && venue->slug.current == $slug] | order(date asc){
  _id,
  title,
  date,
  description,
  "slug": slug.current
}`;

export async function getStaticPaths() {
  const slugs = await client.fetch(`*[_type == "venue"]{ "slug": slug.current }`);
  const paths = slugs.map((slugObj) => ({
    params: { slug: slugObj.slug },
  }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const venue = await client.fetch(venueQuery, { slug: params.slug });
  const venueEvents = await client.fetch(eventsQuery, { slug: params.slug });

  return {
    props: {
      venue,
      venueEvents,
    },
  };
}

export default function VenueDetailPage({ venue, venueEvents }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-2">{venue.name}</h1>

          {venue.imageUrl && (
            <img
              src={venue.imageUrl}
              alt={venue.name}
              className="w-full h-full object-contain"
            />
          )}

          <section className="mt-10 text-left">
            <h1 className="text-2xl font-semibold mb-4">Overview:</h1>
            <h2 className="text-lg text-black mb-4">{venue.overview || "No overview yet."}</h2>
          </section>

          <section className="mt-10 text-left">
            <h2 className="text-2xl font-semibold mb-4">Upcoming Events at {venue.name}</h2>

            {venueEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {venueEvents.map((event) => (
                  <div key={event._id} className="bg-gray-100 rounded p-4 shadow-sm">
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
