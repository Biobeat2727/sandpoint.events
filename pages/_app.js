import "@/styles/globals.css";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import "../styles/globals.css";

 function App({ Component, pageProps }) {
  return (
    <div className="bg-white text-gray-900 min-h-screen">
    <Component {...pageProps} />
    </div>
  );
}

export default App;
