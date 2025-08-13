import { useState } from "react";
import Layout from "../components/layout/Layout";
import RouteForm from "../components/route/RouteForm";
import RouteDisplay from "../components/route/RouteDisplay";
import MapDisplay from "../components/route/MapDisplay";
import WeatherDisplay from "../components/weather/WeatherDisplay";
import {
  Map,
  Sparkles,
  ArrowLeft,
  CheckCircle,
  Lightbulb,
  Cloud,
} from "lucide-react";

/**
 * PlanningPage Component
 *
 * Main route planning interface that orchestrates:
 * - RouteForm: User input and AI route generation
 * - RouteDisplay: Generated route details and save functionality
 * - MapDisplay: Interactive map visualization
 * - WeatherDisplay: 3-day weather forecast
 *
 * Manages state flow between all components and handles
 * the complete route planning workflow.
 */
const PlanningPage = () => {
  // Main application state
  const [generatedRoute, setGeneratedRoute] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState(null);

  // Success state for saved routes
  const [lastSavedRoute, setLastSavedRoute] = useState(null);

  // UI state for better UX
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  /**
   * Handle successful route generation from RouteForm
   */
  const handleRouteGenerated = (routeData) => {
    console.log("Route generated in PlanningPage:", routeData);

    // Set the generated route data
    setGeneratedRoute(routeData);
    setFormData(routeData.formData);

    // Clear any previous success messages
    setShowSuccessMessage(false);
    setLastSavedRoute(null);
  };

  /**
   * Handle successful route saving from RouteDisplay
   */
  const handleRouteSaved = (savedRoute) => {
    console.log("Route saved successfully:", savedRoute);

    // Store saved route info and show success message
    setLastSavedRoute(savedRoute);
    setShowSuccessMessage(true);

    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setShowSuccessMessage(false);
    }, 5000);
  };

  /**
   * Reset to generate a new route
   */
  const handleGenerateNew = () => {
    setGeneratedRoute(null);
    setFormData(null);
    setLastSavedRoute(null);
    setShowSuccessMessage(false);
  };

  /**
   * Get weather location string for the generated route
   */
  const getWeatherLocation = () => {
    if (!formData) return null;

    // Use city if available, otherwise just country
    if (formData.city && formData.city.trim()) {
      return `${formData.city}, ${formData.country}`;
    }
    return formData.country;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-2 flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Map className="h-6 w-6 text-primary-600" />
                </div>
                <span>Plan Your Route</span>
              </h1>
              <p className="text-gray-600 max-w-2xl">
                Generate personalized cycling and trekking routes using AI. Get
                detailed route information, interactive maps, and weather
                forecasts for your adventure.
              </p>
            </div>

            {/* Generate New Route Button (only show when route is generated) */}
            {generatedRoute && (
              <button
                onClick={handleGenerateNew}
                className="btn-secondary flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>New Route</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Message for Saved Routes */}
        {showSuccessMessage && lastSavedRoute && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start space-x-3">
            <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-green-800 font-medium mb-1">
                Route Saved Successfully!
              </h3>
              <p className="text-green-700 text-sm mb-2">
                "{lastSavedRoute.name}" has been saved to your route history.
              </p>
              <div className="flex items-center space-x-4 text-sm text-green-600">
                <span>📏 {lastSavedRoute.totalDistance}km</span>
                <span>🚴 {lastSavedRoute.tripType}</span>
                <span>📍 {lastSavedRoute.country}</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="space-y-8">
          {!generatedRoute ? (
            /* Route Generation Phase */
            <>
              {/* Route Form */}
              <RouteForm
                onRouteGenerated={handleRouteGenerated}
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
              />

              {/* Help Section */}
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="h-6 w-6 text-primary-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-primary-900 mb-2">
                      How It Works
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-primary-800">
                      <div className="flex items-start space-x-2">
                        <Sparkles className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium mb-1">
                            1. Choose Destination
                          </p>
                          <p className="text-primary-700">
                            Select your country and optionally specify a city
                            for more targeted routes.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Map className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium mb-1">
                            2. Pick Adventure Type
                          </p>
                          <p className="text-primary-700">
                            Choose cycling (2-day, city-to-city) or trekking
                            (circular, 5-15km).
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Cloud className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium mb-1">
                            3. Get Complete Plan
                          </p>
                          <p className="text-primary-700">
                            Receive AI-generated routes with maps, weather, and
                            save options.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Route Display Phase */
            <>
              {/* Route Details */}
              <RouteDisplay
                routeData={generatedRoute}
                formData={formData}
                onRouteSaved={handleRouteSaved}
              />

              {/* Map and Weather Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Map Display - Takes 2 columns on large screens */}
                <div className="xl:col-span-2">
                  <MapDisplay routeData={generatedRoute} formData={formData} />
                </div>

                {/* Weather Display - Takes 1 column on large screens */}
                <div className="xl:col-span-1">
                  <WeatherDisplay location={getWeatherLocation()} />
                </div>
              </div>

              {/* Route Summary Footer */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Ready for Your Adventure?
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Your route is planned, weather is forecasted, and the map is
                    ready. Don't forget to save your route for future reference!
                  </p>
                  <div className="flex flex-wrap justify-center items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <span>📱</span>
                      <span>Mobile-friendly maps</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>🌤️</span>
                      <span>Real-time weather</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>💾</span>
                      <span>Save for offline access</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>🔄</span>
                      <span>Generate unlimited routes</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PlanningPage;
