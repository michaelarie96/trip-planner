import { Map, Loader2 } from "lucide-react";

/**
 * LoadingScreen Component
 *
 * Displays during authentication initialization to prevent content flashing
 * Features branded design with app logo and smooth animations
 */
const LoadingScreen = ({ message = "Loading..." }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {/* App Logo with Animation */}
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Map className="h-10 w-10 text-primary-600" />
          </div>

          {/* Rotating loader around logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-24 w-24 text-primary-300 animate-spin" />
          </div>
        </div>

        {/* App Title */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Personal Trip Planner
        </h1>

        {/* Loading Message */}
        <p className="text-gray-600 mb-6">{message}</p>

        {/* Loading Progress Animation */}
        <div className="w-48 mx-auto">
          <div className="bg-gray-200 rounded-full h-1 overflow-hidden">
            <div className="bg-primary-600 h-1 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Feature Hints */}
        <div className="mt-8 text-xs text-gray-500 space-y-1">
          <p>🚴 AI-Powered Routes</p>
          <p>🌤️ Weather Forecasts</p>
          <p>🗺️ Interactive Maps</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
