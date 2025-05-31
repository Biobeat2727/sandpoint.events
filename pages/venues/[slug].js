import { useRouter } from "next/router";
import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

// Sanity queries
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

// Generate static paths
export async function getStaticPaths() {
  const slugs = await client.fetch(`*[_type == "venue"]{ "slug": slug.current }`);
  const paths = slugs.map((slugObj) => ({
    params: { slug: slugObj.slug },
  }));

  return { paths, fallback: false };
}

// Fetch data
export async function getStaticProps({ params }) {
  const venue = await client.fetch(venueQuery, { slug: params.slug });
  const venueEvents = await client.fetch(eventsQuery, { slug: params.slug });

  return {
    props: {
      venue,
      venueEvents,
    },
    revalidate: 60,
  };
}

// Component
export default function VenueDetailPage({ venue, venueEvents }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 pt-24 pb-16 px-4">
        <motion.div
          className="max-w-4xl mx-auto space-y-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Title */}
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-center">
            {venue.name}
          </h1>

          {/* Image */}
          {/* Image with framed card */}
{venue.imageUrl && (
  <div className="w-full max-w-xl mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
    <img
      src={venue.imageUrl}
      alt={venue.name}
      className="w-full h-auto object-contain"
    />
  </div>
)}


          {/* Overview */}
          <section>
            <h2 className="text-2xl font-semibold mb-3">Overview</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              {venue.overview || "No overview available for this venue."}
            </p>
          </section>

          {/* Events */}
          <section>
            <h2 className="text-2xl font-semibold mb-6">
              Upcoming Events at {venue.name}
            </h2>

            {venueEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {venueEvents.map((event) => (
                  <div
                    key={event._id}
                    className="bg-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <p className="text-sm text-gray-500 mb-2">{event.date}</p>
                    <p className="text-sm text-gray-700 mb-3">{event.description}</p>
                    <a
                      href={`/events/${event.slug}`}
                      className="text-green-700 font-semibold hover:underline text-sm"
                    >
                      View Details →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">
                No upcoming events listed for this venue.
              </p>
            )}
          </section>
        </motion.div>
      </main>
      <Footer />
    </>
  );
}
