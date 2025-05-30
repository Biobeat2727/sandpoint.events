import { useRouter } from "next/router";
import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

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

  console.log("Generated venue paths:", paths);
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
    revalidate: 60, // ISR to update content
  };
}

export default function VenueDetailPage({ venue, venueEvents }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800">
        <motion.div
          className="text-center pt-20"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold mb-4 px-6 max-w-3xl mx-auto">{venue.name}</h1>

          {venue.imageUrl && (
            <motion.img
              src={venue.imageUrl}
              alt={venue.name}
              className="w-full object-cover"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            />
          )}

          <motion.section
            className="mt-10 text-left px-6 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-semibold mb-4">Overview:</h2>
            <p className="text-lg text-black mb-4">{venue.overview || "No overview yet."}</p>
          </motion.section>

          <motion.section
            className="mt-10 text-left px-6 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-semibold mb-4">Upcoming Events at {venue.name}</h2>

            {venueEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {venueEvents.map((event, index) => (
                  <motion.div
                    key={event._id}
                    className="bg-gray-100 rounded p-4 shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    viewport={{ once: true }}
                  >
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <p className="text-sm text-gray-500 mb-2">{event.date}</p>
                    <p className="text-sm text-gray-700 mb-4">{event.description}</p>
                    <a
                      href={`/events/${event.slug}`}
                      className="text-green-700 font-semibold hover:underline"
                    >
                      View Details →
                    </a>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 italic">
                No upcoming events listed for this venue.
              </p>
            )}
          </motion.section>
        </motion.div>
      </main>
      <Footer />
    </>
  );
}
