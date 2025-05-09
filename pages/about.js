import Navbar from "../components/Navbar";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12">
        <h1 className="text-4xl font-bold mb-6">About Sandpoint.Events</h1>

        <p className="mb-4">
          Sandpoint.Events is a community-driven hub for local happenings in and around Sandpoint, Idaho.
        </p>
        <p className="mb-4">
          We showcase live music, arts, culture, and small-town energy to make it easier for locals and visitors to find what’s going on.
        </p>
        <p className="mb-4">
          This project is built by and for the people of Sandpoint. If you want to get involved, contribute an event, or suggest a feature—head over to the Submit page or shoot us a message.
        </p>
      </main>
      <Footer />
    </>
  );
}
