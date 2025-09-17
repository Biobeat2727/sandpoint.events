import { Carousel } from "react-responsive-carousel";
import { motion, AnimatePresence } from "framer-motion";
import client from "@/lib/sanity";
import Link from "next/link";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { formatDate } from "@/utils/formatDate";
import { useState } from "react";

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
    revalidate: 60,
  };
}

export default function HeroCarousel({ events }) {
  const now = new Date();
  const upcomingEvents = events
    .filter((event) => new Date(event.date) > now)
    .slice(0, 3);

  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <div className="relative w-full min-h-screen overflow-hidden pt-20">
      <Carousel
        autoPlay
        infiniteLoop
        showThumbs={false}
        showStatus={false}
        interval={6000}
        transitionTime={800}
        emulateTouch
        swipeScrollTolerance={30}
        preventMovementUntilSwipeScrollTolerance={true}
        onChange={(index) => setCurrentSlide(index)}
        className="w-full h-full"
      >
        {upcomingEvents.map((event, index) => {
          const isActive = currentSlide === index;

          return (
            <div
              key={event._id}
              className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center relative overflow-hidden bg-transparent"
            >
              {/* Background image blur */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${event.imageUrl})`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  filter: "blur(20px)",
                  zIndex: 1,
                }}
              />

              {/* Gradient overlays */}
              <div className="absolute inset-0 from-black/60 via-transparent to-black/60 z-10 pointer-events-none" />
              <div className="absolute inset-0 bg-black/40 z-20" />

              {/* Inner content */}
              <div className="relative z-30 flex flex-col-reverse md:flex-row items-center justify-between h-full w-full max-w-6xl mx-auto px-4 gap-3 sm:py-16 gap-2">
                <AnimatePresence mode="wait">
                  {isActive && (
                    <>
                      <motion.div
                        key={`text-${event._id}`}
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 10, y: 0 }}
                        exit={{ opacity: 0, y: -100 }}
                        transition={{ duration: 0.8 }}
                        className="md:w-1/2 w- full text-center md:text-left p-4 bg-black/30 backdrop-blur-md shadow-lg rounded-xl"
                      >
                        <h2 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg mb-1">
                          <span className="bg-gradient-to-r from-green-400 to-yellow-300 bg-clip-text text-transparent">
                            {event.title}
                          </span>
                        </h2>
                        <p className="text-lg font-medium text-green-300 mb-1">
                          {formatDate(event.date)}
                        </p>
                        <p className="text-gray-100 mb-4 line-clamp-4">
                          {event.description}
                        </p>
                        <Link
                          href={`/events/${event.slug}`}
                          className="inline-block bg-green-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-800 transition duration-300 shadow-md"
                        >
                          View Event →
                        </Link>
                      </motion.div>

                      <motion.div
                        key={`img-${event._id}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="md:w-1/2 w-full flex justify-center items-center z-10 py-6"
                      >
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="h-64 sm:h-64 md:h-auto md:max-h-[65vh] object-contain max-w-full"

                        />
                      </motion.div>


                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}
