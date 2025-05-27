// components/HeroCarousel.jsx

import { Carousel } from "react-responsive-carousel";
import client from "@/lib/sanity";
import Link from "next/link";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { formatDate } from "@/utils/formatDate";

export async function getStaticProps() {
  const query = `*[_type == "event"]{
    _id,
    title,
    "slug": slug.current,
    date,
    description,
    "imageUrl": image.asset->url
  } | order(date asc)`;

  const events = await client.fetch(query);

  return {
    props: { events },
    revalidate: 60
  };
}

export default function HeroCarousel({ events }) {
  const now = new Date();
  const upcomingEvents = events
    .filter(event => new Date(event.date) > now)
    .slice(0, 3);

  console.log("Upcoming Events in Carousel:", upcomingEvents);

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      <Carousel
        autoPlay
        infiniteLoop
        showThumbs={false}
        showStatus={false}
        interval={6000}
        transitionTime={800}
        emulateTouch
        className="w-full h-full"
      >
        {upcomingEvents.map((event) => (
  <div
    key={event._id}
    className="w-full min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent"
  >
    {/* Background Image with heavy blur */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${event.imageUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "cover",
        filter: "blur(50px)",
        zIndex: 1,
      }}
    />
    {/* Radial gradient vignette overlay */}
    <div className="absolute inset-0 bg-gradient-radial from-black/60 via-transparent to-black/60 z-10 pointer-events-none" />

    {/* Semi-transparent dark overlay */}
    <div className="absolute inset-0 bg-black/40 z-20" />

    {/* Inner content */}
    <div className="relative z-30 flex flex-col md:flex-row items-center justify-center h-full w-full max-w-6xl mx-auto px-4 gap-8">
      
      {/* Text Content */}
      <div className="md:w-1/2 text-center md:text-left p-6 rounded-xl bg-black/30 backdrop-blur-md shadow-lg">
        <h2 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg mb-1">
          <span className="bg-gradient-to-r from-green-400 to-yellow-300 bg-clip-text text-transparent">
            {event.title}
          </span>
        </h2>
        <p className="text-lg font-medium text-green-300 mb-1">{formatDate(event.date)}</p>
        <p className="text-gray-100 mb-4 line-clamp-4">{event.description}</p>
        <Link
          href={`/events/${event.slug}`}
          className="inline-block bg-green-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-800 transition duration-300 shadow-md"
        >
          View Event →
        </Link>
      </div>

      {/* Event Image */}
      <div className="md:w-1/2 flex justify-center z-10">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="rounded-xl shadow-2xl border border-white/20 hover:rotate-1 transition-transform duration-300 ease-in-out max-h-60 sm:max-h-72 object-contain"
        />
      </div>
    </div>
  </div>
))}
      </Carousel>
    </div>
  );
}