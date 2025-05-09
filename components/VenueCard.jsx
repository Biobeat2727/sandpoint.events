import Link from "next/link";

export default function VenueCard({ venue }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4 max-w-md">
      {venue.imageUrl && (
        <div className="relative w-full h-48 overflow-hidden">
          {/* Image container with no overflow */}
          <img
            src={venue.imageUrl}
            alt={venue.name}
            className="w-full h-full object-contain" // Ensures the image fits neatly into the container without cropping
          />
        </div>
      )}
      <h3 className="text-xl font-semibold mb-1">{venue.name}</h3>
      <p className="text-sm text-gray-600 mb-2">{venue.address}</p>
      <Link
        href={`/venues/${venue.slug}`}
        className="inline-block text-green-700 font-semibold hover:underline"
      >
        View Venue →
      </Link>
    </div>
  );
}
