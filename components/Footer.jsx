export default function Footer() {
    return (
      <footer className="bg-gray-100 text-gray-600 text-sm py-6 px-4 mt-12 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <p>&copy; {new Date().getFullYear()} Sandpoint.Events. All rights reserved.</p>
          <p>
            Built with ❤️ by <a href="https://your-site-or-social.com" className="underline hover:text-green-700">Biobeat</a>
          </p>
        </div>
      </footer>
    );
  }
  