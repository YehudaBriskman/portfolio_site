import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  /* Measure and rhythm only. The palette here is Tailwind's stock greys
     rather than the site's, which is a separate problem from this one. */
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="wrap section-y text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-6 text-xl text-gray-600">Oops! Page not found</p>
        <Link to="/" className="btn btn-quiet mt-12">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
