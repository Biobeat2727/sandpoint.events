import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      <nav className="bg-gradient-to-b from-green-500 to-transparent p-4 h-20 w-full flex fixed top-0 z-50">
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

          {!isMenuOpen && (
  <div className="md:hidden">
    <button onClick={toggleMenu} className="text-white focus:outline-none">
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  </div>
)}

        </div>
      </nav>

      {/* Mobile Menu OUTSIDE of <nav> so it doesn't block scroll */}
<AnimatePresence>
  {isMenuOpen && (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="md:hidden fixed top-0 right-0 h-full w-56 bg-gradient-to-bl from-green-600 via-green-50 to-white/10 backdrop-blur-md shadow-2xl z-50 rounded-l-xl p-6 flex flex-col gap-6"
    >
      <button
        onClick={toggleMenu}
        className="text-gray-600 hover:text-red-500 text-2xl self-end"
        aria-label="Close menu"
      >
        ✕
      </button>

      <Link
        href="/"
        onClick={toggleMenu}
        className="text-gray-800 text-lg font-semibold hover:text-green-700 w-full text-center px-4 py-2 rounded-lg bg-white/80 shadow-sm hover:bg-green-200 transition"
      >
        Home
      </Link>
      <Link
        href="/events"
        onClick={toggleMenu}
        className="text-gray-800 text-lg font-semibold hover:text-green-700 w-full text-center px-4 py-2 rounded-lg bg-white/80 shadow-sm hover:bg-green-200 transition"
      >
        Events
      </Link>
      <Link
        href="/venues"
        onClick={toggleMenu}
        className="text-gray-800 text-lg font-semibold hover:text-green-700 w-full text-center px-4 py-2 rounded-lg bg-white/80 shadow-sm hover:bg-green-200 transition"
      >
        Venues
      </Link>
      <Link
        href="/submit"
        onClick={toggleMenu}
        className="text-gray-800 text-lg font-semibold hover:text-green-700 w-full text-center px-4 py-2 rounded-lg bg-white/80 shadow-sm hover:bg-green-200 transition"
      >
        Submit
      </Link>
    </motion.div>
  )}
</AnimatePresence>




    </>
  );
};

export default Navbar;
