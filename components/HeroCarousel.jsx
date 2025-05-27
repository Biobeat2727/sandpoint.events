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

  return (
    <div className="w-full mb-12">
      <Carousel
        autoPlay
        infiniteLoop
        showThumbs={false}
        showStatus={false}
        interval={6000}
        transitionTime={800}
        emulateTouch
        className="w-full"
      >
        {upcomingEvents.map((event) => (
          <div
            key={event._id}
            // MODIFIED: Changed h-[26rem] to min-h-[26rem] on mobile to allow vertical growth
            // This ensures the slide can expand if content needs more space.
            className="min-h-[26rem] md:h-[28rem] flex items-center justify-center relative overflow-hidden bg-transparent"
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
            {/* Semi-transparent Dark Overlay for better text readability */}
            <div className="absolute inset-0 bg-black bg-opacity-50 z-20"></div>

            {/* Main Content Container (Image and Text) */}
            <div
              // MODIFIED: Adjusted horizontal padding for smaller screens
              className="relative flex flex-col md:flex-row items-center justify-between w-full max-w-6xl px-4 sm:px-6 gap-6 z-30"
            >
              {/* Text Content */}
              <div className="md:w-1/2 text-center md:text-left p-4 rounded-lg bg-black bg-opacity-30">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-shadow-md">
                  {event.title}
                </h2>
                <p className="text-sm text-gray-200 mb-2 text-shadow-sm">
                  {formatDate(event.date)}
                </p>
                {/* Event Description with Line-clamp */}
                <p className="text-gray-100 mb-4 line-clamp-4 text-shadow-sm">
                  {event.description}
                </p>
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
                  // MODIFIED: Reduced max-height for very small screens
                  className="rounded-lg shadow-xl max-h-60 sm:max-h-72 object-contain"
                />
              </div>
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
}