import Navbar from "../../components/Navbar";
import VenueCard from "@/components/VenueCard";
import venues from "../../data/venues.json";
import Footer from "@/components/Footer";

export default function VenuesPage() {
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
            <VenueCard key={venue.id} venue={venue} />
        ))}
          </div>
      </main>
      <Footer />
    </>
  );
}
