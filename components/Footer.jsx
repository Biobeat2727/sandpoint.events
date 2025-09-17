import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-300">
      <div className="container-responsive">
        {/* Main Footer Content */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <img
                src="/images/logo.png"
                alt="Sandpoint.events logo"
                className="h-12 object-contain filter brightness-0 invert"
              />
            </div>
            <p className="text-neutral-400 leading-relaxed max-w-md mb-6">
              Your premier source for discovering events, live music, and cultural experiences in beautiful Sandpoint, Idaho.
            </p>
            <div className="flex space-x-4">
              {/* Social Links - Add actual links when available */}
              <a
                href="#"
                className="w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center hover:bg-brand-600 transition-colors"
                aria-label="Follow us on Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center hover:bg-brand-600 transition-colors"
                aria-label="Follow us on Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.448-.596-3.205-1.533l1.038-.69c.548.675 1.375 1.107 2.167 1.107 1.63 0 2.958-1.328 2.958-2.958 0-1.63-1.328-2.958-2.958-2.958-.782 0-1.565.3-2.167 1.107l-1.038-.69c.757-.937 1.908-1.533 3.205-1.533 2.27 0 4.074 1.804 4.074 4.074s-1.804 4.074-4.074 4.074z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <nav className="space-y-3">
              <Link
                href="/events"
                className="block text-sm hover:text-brand-400 transition-colors"
              >
                Browse Events
              </Link>
              <Link
                href="/venues"
                className="block text-sm hover:text-brand-400 transition-colors"
              >
                Find Venues
              </Link>
              <Link
                href="/events/calendar"
                className="block text-sm hover:text-brand-400 transition-colors"
              >
                Event Calendar
              </Link>
              <Link
                href="/submit"
                className="block text-sm hover:text-brand-400 transition-colors"
              >
                Submit Event
              </Link>
            </nav>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold mb-4">Get in Touch</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Sandpoint, Idaho</span>
              </div>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a
                  href="mailto:hello@sandpoint.events"
                  className="hover:text-brand-400 transition-colors"
                >
                  hello@sandpoint.events
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-neutral-400">
            <p>
              &copy; {currentYear} Sandpoint.Events. All rights reserved.
            </p>
            <div className="flex items-center space-x-6">
              <a href="/privacy" className="hover:text-brand-400 transition-colors">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-brand-400 transition-colors">
                Terms of Service
              </a>
              <span className="flex items-center">
                Built with{" "}
                <svg className="w-4 h-4 mx-1 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                by{" "}
                <a
                  href="https://your-site-or-social.com"
                  className="ml-1 hover:text-brand-400 transition-colors font-medium"
                >
                  Biobeat
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
  