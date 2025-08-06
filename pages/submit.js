import React, { useState } from "react";
import client from "@/lib/sanity";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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

    if (!formData.title || !formData.date || !formData.venueSlug) {
      alert("Please fill in all required fields.");
      return;
    }

    console.log("New Event:", formData, venueName);
    setSubmitted(true);
  }

  // ✅ This return must be inside the SubmitEvent function
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white text-gray-800 px-6 py-12 max-w-2xl mx-auto">
        {/* ... your JSX form ... */}
      </main>
      <Footer />
    </>
  );
}
