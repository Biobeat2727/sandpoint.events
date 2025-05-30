import { useState } from "react";
import client from "@/lib/sanity"; // ✅
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export async function getStaticProps() {
  const venues = await client.fetch(`*[_type == "venue"] | order(name asc){
    name,
    "slug": slug.current
  }`);
  return { props: { venues } };
}

export default function SubmitEvent({ venues }) {
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    venueSlug: venues[0]?.slug || "",
    customVenue: "",
    imageUrl: "",
    description: "",
  });

  // ...rest of your component stays unchanged
}

      

  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const venueName =
  formData.venueSlug === "other"
    ? formData.customVenue
    : venues.find((v) => v.slug === formData.venueSlug)?.name || "Unknown";


    // Simple field validation
    if (!formData.title || !formData.date || !formData.venueSlug) {
      alert("Please fill in all required fields.");
      return;
    }

    console.log("New Event:", formData, venueName,)
    setSubmitted(true);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Submit an Event</h1>

        {submitted ? (
          <div className="bg-green-100 text-green-800 p-4 rounded-lg shadow mb-6">
            <p className="font-medium">Thanks! Your event was submitted successfully.</p>
            <pre className="mt-4 text-sm text-gray-700 bg-white p-2 rounded">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block mb-1 font-medium" htmlFor="title">Event Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium" htmlFor="date">Date *</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div>
  <label className="block mb-1 font-medium" htmlFor="venueSlug">Venue *</label>
  <select
    id="venueSlug"
    name="venueSlug"
    value={formData.venueSlug}
    onChange={handleChange}
    required
    className="w-full p-2 border border-gray-300 rounded"
  >
    {venues.map((venue) => (
      <option key={venue.slug} value={venue.slug}>
        {venue.name}
      </option>
    ))}
    <option value="other">Other (Not listed)</option>
  </select>
</div>

{formData.venueSlug === "other" && (
  <div className="mt-4">
    <label className="block mb-1 font-medium" htmlFor="customVenue">Enter Venue Name *</label>
    <input
      type="text"
      id="customVenue"
      name="customVenue"
      value={formData.customVenue}
      onChange={handleChange}
      required
      className="w-full p-2 border border-gray-300 rounded"
    />
  </div>
)}

            <div>
              <label className="block mb-1 font-medium" htmlFor="imageUrl">Image URL</label>
              <input
                type="text"
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium" htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows="4"
                value={formData.description}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <button
              type="submit"
              className="bg-green-700 hover:bg-green-800 text-white font-semibold py-2 px-4 rounded"
            >
              Submit Event
            </button>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
