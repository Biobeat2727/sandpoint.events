import { Carousel } from "react-responsive-carousel";
import client from "@/lib/sanity"; // 👈 Sanity client
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
            className="h-[26rem] md:h-[28rem] flex items-center justify-center relative overflow-hidden bg-transparent"
          >
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
            <div className="relative flex flex-col md:flex-row items-center justify-between w-full max-w-6xl px-6 gap-6 z-10">
              <div className="md:w-1/2 text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{event.title}</h2>
                <p className="text-sm text-gray-200 mb-2">{formatDate(event.date)}</p>
                <p className="text-gray-100 mb-4">{event.description}</p>
                <Link
                  href={`/events/${event.slug}`}
                  className="inline-block text-green-700 font-semibold hover:underline"
                >
                  View Event →
                </Link>
              </div>
              <div className="md:w-1/2 flex justify-center z-10">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="rounded-lg shadow-md max-h-72 object-contain"
                />
              </div>
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
}
