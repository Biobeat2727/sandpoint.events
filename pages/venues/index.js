import Navbar from "@/components/Navbar";
import VenueCard from "@/components/VenueCard";
import Footer from "@/components/Footer";
import client from "@/lib/sanity";

// GROQ query to fetch venues
const query = `*[_type == "venue"] | order(name asc){
  _id,
  name,
  address,
  "slug": slug.current,
  "imageUrl": image.asset->url
}`;

// Fetch venue data at build time
export async function getStaticProps() {
  const venues = await client.fetch(query);
  return {
    props: {
      venues,
    },
  };
}

export default function VenuesPage({ venues }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">All Venues</h1>

        <p className="text-gray-600 mb-6">
          Browse Sandpoint venues to see where events are happening around town.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <VenueCard key={venue._id} venue={venue} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
