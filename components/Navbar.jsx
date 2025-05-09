import Link from "next/link";

const Navbar = () => {
  return (
    <nav className="bg-green-600 p-4 h-24 w-full flex">
      {/* Main flex container */}
      <div className="flex items-center justify-between w-full max-w-full mx-auto">

        {/* Logo Section on the Left */}
        <Link href="/" className="flex-shrink-0">
          <img
            src="/images/logo.png" // Path to logo
            alt="Sandpoint.events logo"
            className="max-h-28 md:max-h-32 lg:max-h-36 object-contain"
          />
        </Link>

        {/* Links on the Right */}
        <div className="flex space-x-6 text-white text-lg ml-auto">
          <Link href="/">Home</Link>
          <Link href="/events">Events</Link>
          <Link href="/venues">Venues</Link>
          <Link href="/submit">Submit</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
