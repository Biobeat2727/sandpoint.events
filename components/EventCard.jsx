export default function EventCard({ event }) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4 max-w-md">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="rounded mb-3 h-48 w-full object-cover"
        />
        <h3 className="text-xl font-semibold mb-1">{event.title}</h3>
        <p className="text-sm text-gray-600 mb-2">{event.date}</p>
        <p className="text-gray-700 mb-3">{event.description}</p>
        <a
          href={`/events/${event.slug}`}
          className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          View Details
        </a>
      </div>
    );
  }
  