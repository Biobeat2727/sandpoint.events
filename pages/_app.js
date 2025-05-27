import "@/styles/globals.css"; // Keep this one, assuming it's your intended path via alias
import "react-responsive-carousel/lib/styles/carousel.min.css";
// Removed: import "../styles/globals.css"; // This line is now removed

function App({ Component, pageProps }) {
  return (
    // MODIFIED: Removed min-h-screen from this div.
    // The height of the overall application will now be determined by its content.
    <div className="bg-white text-gray-900">
      <Component {...pageProps} />
    </div>
  );
}

export default App;