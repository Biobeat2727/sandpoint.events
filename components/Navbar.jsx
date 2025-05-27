import Link from "next/link";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      <nav className="bg-gradient-to-b from-green-600 to-transparent p-4 h-24 w-full flex fixed top-0 z-50">
        <div className="flex items-center justify-between w-full max-w-full mx-auto">
          <Link href="/" className="flex-shrink-0">
            <img
              src="/images/logo.png"
              alt="Sandpoint.events logo"
              className="max-h-28 md:max-h-32 lg:max-h-36 object-contain"
            />
          </Link>

          <div className="hidden md:flex space-x-6 flex-wrap text-white text-lg ml-auto">
            <Link href="/">Home</Link>
            <Link href="/events">Events</Link>
            <Link href="/venues">Venues</Link>
            <Link href="/submit">Submit</Link>
          </div>

          <div className="md:hidden">
            <button onClick={toggleMenu} className="text-white focus:outline-none">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu OUTSIDE of <nav> so it doesn't block scroll */}
      {isMenuOpen && (
        <div className="md:hidden fixed top-24 left-0 w-full bg-green-700 p-4 space-y-4 shadow-lg z-40">
          <Link href="/" className="block text-white hover:text-gray-200" onClick={toggleMenu}>
            Home
          </Link>
          <Link href="/events" className="block text-white hover:text-gray-200" onClick={toggleMenu}>
            Events
          </Link>
          <Link href="/venues" className="block text-white hover:text-gray-200" onClick={toggleMenu}>
            Venues
          </Link>
          <Link href="/submit" className="block text-white hover:text-gray-200" onClick={toggleMenu}>
            Submit
          </Link>
        </div>
      )}
    </>
  );
};

export default Navbar;
