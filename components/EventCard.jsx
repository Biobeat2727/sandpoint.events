// components/EventCard.jsx

import Link from "next/link";
import { formatDate } from "@/utils/formatDate";

export default function EventCard({ event }) {
  return (
    <div className="rounded-xl overflow-hidden relative shadow-md border border-gray-200 group hover:shadow-xl transition duration-300 bg-black/40 backdrop-blur-lg h-80 flex flex-col justify-between">
      {/* Blurred background image */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-lg scale-110 opacity-90"
        style={{ backgroundImage: `url(${event.imageUrl})` }}
        aria-hidden="true"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 z-0" />

      {/* Main content */}
      <div className="relative z-10 p-4 flex flex-col h-full text-white text-center">
  {/* Image */}
  <div className="flex justify-center items-center h-32">
    <img
      src={event.imageUrl}
      alt={event.title}
      className="max-h-full max-w-full object-contain border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]"
    />
  </div>

  {/* Text */}
  <div className="flex-grow mt-2 flex flex-col justify-start">
    <h3 className="text-lg font-semibold drop-shadow-sm leading-tight">
      {event.title}
    </h3>
    <p className="text-sm text-green-200 text-opacity-90">
      {formatDate(event.date)}
    </p>
    <p className="text-sm text-white/90 line-clamp-2 mt-1">
      {event.description}
    </p>
  </div>

  {/* Button */}
  <div className="mt-3">
    <Link
      href={`/events/${event.slug}`}
      className="inline-block bg-green-700 text-white font-semibold py-1 px-3 rounded hover:bg-green-800 transition duration-300 text-sm"
    >
      View Event →
    </Link>
  </div>
</div>


    </div>
  );
}