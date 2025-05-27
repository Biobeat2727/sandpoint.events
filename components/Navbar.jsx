// components/Navbar.jsx

import Link from "next/link";
import { useState } from "react"; // Import useState for managing menu state

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to control mobile menu visibility

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-green-600 p-4 h-24 w-full flex sticky top-0 z-50"> {/* Added sticky top-0 z-50 */}
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

        {/* Desktop Navigation Links (Hidden on mobile, flex on medium screens and up) */}
        <div className="hidden md:flex space-x-6 flex-wrap text-white text-lg ml-auto">
          <Link href="/">Home</Link>
          <Link href="/events">Events</Link>
          <Link href="/venues">Venues</Link>
          <Link href="/submit">Submit</Link>
        </div>

        {/* Mobile Hamburger Icon (visible on small screens only) */}
        <div className="md:hidden">
          <button onClick={toggleMenu} className="text-white focus:outline-none focus:text-white">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isMenuOpen ? (
                // Close icon (X) when menu is open
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                // Hamburger icon when menu is closed
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu (conditionally rendered below the main nav when isMenuOpen is true) */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-24 left-0 w-full bg-green-700 p-4 space-y-4 shadow-lg"> {/* Adjusted top to be below the 24-unit height navbar, using a slightly darker green */}
          <Link href="/" className="block text-white hover:text-gray-200 transition duration-300" onClick={toggleMenu}>
            Home
          </Link>
          <Link href="/events" className="block text-white hover:text-gray-200 transition duration-300" onClick={toggleMenu}>
            Events
          </Link>
          <Link href="/venues" className="block text-white hover:text-gray-200 transition duration-300" onClick={toggleMenu}>
            Venues
          </Link>
          <Link href="/submit" className="block text-white hover:text-gray-200 transition duration-300" onClick={toggleMenu}>
            Submit
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;