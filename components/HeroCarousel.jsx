import { Carousel } from "react-responsive-carousel";
import events from "../data/events.json";
import Link from "next/link";
import "react-responsive-carousel/lib/styles/carousel.min.css";

const parseEventDate = (dateString) => {
  const months = [
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"
  ];
  const regex = /([A-Za-z]+) (\d{1,2})(st|nd|rd|th), (\d{4}) • (\d{1,2}):(\d{2}) (AM|PM)/;
  const match = dateString.match(regex);
  if (!match) return null;
  const [_, monthName, day, , year, hour, minute, period] = match;
  const month = months.indexOf(monthName);
  let hours = parseInt(hour);
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return new Date(year, month, day, hours, minute);
};

export default function HeroCarousel() {
  const today = new Date();
  const upcomingEvents = events
    .filter(event => parseEventDate(event.date) > today)
    .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date))
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
            key={event.id}
            className="h-[26rem] md:h-[28rem] flex items-center justify-center relative overflow-hidden bg-transparent" // Make the parent background transparent
          >
            {/* Full background blur effect applied to the entire background */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${event.imageUrl})`, // Same image for blur effect
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "cover",
                filter: "blur(50px)", // Apply a strong blur effect
                zIndex: 1, // Ensure the blur stays behind the content
              }}
            />

            {/* Content on top of the blurred background */}
            <div className="relative flex flex-col md:flex-row items-center justify-between w-full max-w-6xl px-6 gap-6 z-10">
              {/* Left side: Event Info */}
              <div className="md:w-1/2 text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{event.title}</h2>
                <p className="text-sm text-gray-200 mb-2">{event.date}</p>
                <p className="text-gray-100 mb-4">{event.description}</p>
                <Link
                  href={`/events/${event.slug}`}
                  className="inline-block text-green-700 font-semibold hover:underline"
                >
                  View Event →
                </Link>
              </div>

              {/* Right side: Flyer image */}
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