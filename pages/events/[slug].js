import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

const query = `*[_type == "event" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  date,
  description,
  "imageUrl": image.asset->url,
  venue->{
    name,
    address,
    "imageUrl": image.asset->url,
    slug
  }
}`;

const relatedQuery = `*[_type == "event" && slug.current != $slug] | order(date desc)[0...3]{
  _id,
  title,
  "slug": slug.current,
  date
}`;

export default function EventDetailPage({ event, relatedEvents }) {
  const venue = event.venue;

  return (
    <>
      <Navbar />
      <main className="bg-white text-gray-900 px-4 sm:px-6 py-12 max-w-6xl mx-auto">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-80 object-cover rounded-lg mb-10"
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
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

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Main Info</h2>
              <p className="text-gray-700">{event.description}</p>
              <p className="mt-4 italic text-sm">Presented by <span className="text-gray-600">Organizer Name</span></p>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Location</h2>
              <p className="text-gray-800">{venue?.name}</p>
              <p className="text-gray-600">{venue?.address}</p>
            </div>
          </div>

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

        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Related Events</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {relatedEvents.map((related) => (
              <div key={related._id} className="bg-gray-100 p-4 rounded shadow-sm">
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

export async function getStaticPaths() {
  const slugs = await client.fetch(`*[_type == "event"]{ "slug": slug.current }`);

  return {
    paths: slugs.map(({ slug }) => ({ params: { slug } })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const event = await client.fetch(query, { slug: params.slug });
  const relatedEvents = await client.fetch(relatedQuery, { slug: params.slug });

  return {
    props: { event, relatedEvents },
    revalidate: 60
  };
}
