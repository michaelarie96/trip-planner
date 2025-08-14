import { useState } from "react";
import {
  X,
  MapPin,
  Calendar,
  Route,
  Clock,
  Trash2,
  Star,
  Bike,
  Mountain,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import MapDisplay from "./MapDisplay";
import WeatherDisplay from "../weather/WeatherDisplay";

/**
 * RouteDetailModal Component
 *
 * Full-screen modal displaying complete route information:
 * - Route metadata (name, description, location, stats)
 * - Interactive map with route visualization
 * - Current 3-day weather forecast
 * - Country image (if available)
 * - Delete functionality
 * - Responsive layout with proper scrolling
 */
const RouteDetailModal = ({ route, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Get trip type styling
  const getTripTypeStyles = () => {
    if (route.tripType === "cycling") {
      return {
        badge: "badge-cycling",
        icon: Bike,
        borderAccent: "border-l-cycling-600",
        bgAccent: "bg-cycling-50",
      };
    } else {
      return {
        badge: "badge-trekking",
        icon: Mountain,
        borderAccent: "border-l-trekking-600",
        bgAccent: "bg-trekking-50",
      };
    }
  };

  const styles = getTripTypeStyles();
  const TripIcon = styles.icon;

  // Handle delete with confirmation
  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${route.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      setIsDeleting(true);
      try {
        await onDelete(route.id);
        // Modal will be closed by parent component
      } catch (error) {
        console.error("Delete failed:", error);
        setIsDeleting(false);
        alert("Failed to delete route. Please try again.");
      }
    }
  };

  // Handle escape key to close modal
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  };

  // Get location display string
  const getLocationDisplay = () => {
    if (route.city && route.country) {
      return `${route.city}, ${route.country}`;
    }
    return route.country || "Unknown location";
  };

  // Get weather location for API call
  const getWeatherLocation = () => {
    if (route.city && route.country) {
      return `${route.city}, ${route.country}`;
    }
    return route.country;
  };

  // Create route data structure for MapDisplay
  const getRouteDataForMap = () => {
    return {
      routeData: {
        routeData: route.routeData, // Match expected nested structure
      },
    };
  };

  // Create form data structure for MapDisplay
  const getFormDataForMap = () => {
    return {
      tripType: route.tripType,
      country: route.country,
      city: route.city,
    };
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Modal Container */}
      <div
        className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 ${styles.bgAccent} rounded-lg flex items-center justify-center`}
            >
              <TripIcon
                className={`h-5 w-5 ${styles.primary || "text-gray-600"}`}
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {route.name}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className={styles.badge}>
                  {route.tripType.charAt(0).toUpperCase() +
                    route.tripType.slice(1)}
                </span>
                {route.difficulty && (
                  <span className="badge-neutral">{route.difficulty}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Delete Button */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete route"
            >
              <Trash2 className="h-5 w-5" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-6 space-y-6">
            {/* Route Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Route Info */}
              <div className="lg:col-span-2 space-y-4">
                {/* Location and Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>Location</span>
                    </h3>
                    <p className="text-gray-900">{getLocationDisplay()}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Created</span>
                    </h3>
                    <p className="text-gray-900">
                      {formatDate(route.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {route.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Description
                    </h3>
                    <p className="text-gray-900 leading-relaxed">
                      {route.description}
                    </p>
                  </div>
                )}

                {/* Route Statistics */}
                <div className={`${styles.bgAccent} rounded-lg p-4`}>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Route Statistics
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <Route className="h-4 w-4 text-gray-600" />
                      </div>
                      <p className="text-xl font-semibold text-gray-900">
                        {route.routeData?.totalDistance || 0}km
                      </p>
                      <p className="text-xs text-gray-600">Total Distance</p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <Clock className="h-4 w-4 text-gray-600" />
                      </div>
                      <p className="text-xl font-semibold text-gray-900">
                        {route.routeData?.estimatedDuration || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-600">Duration</p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1 mb-1">
                        <Star className="h-4 w-4 text-gray-600" />
                      </div>
                      <p className="text-xl font-semibold text-gray-900 capitalize">
                        {route.routeData?.difficulty || "Moderate"}
                      </p>
                      <p className="text-xs text-gray-600">Difficulty</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Country Image */}
              <div className="lg:col-span-1">
                {route.imageUrl && !imageError ? (
                  <div className="relative">
                    <img
                      src={route.imageUrl}
                      alt={`${route.country} landscape`}
                      className="w-full h-48 lg:h-64 object-cover rounded-lg"
                      onError={() => setImageError(true)}
                    />
                    {/* Image attribution overlay */}
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
                      <ExternalLink className="h-3 w-3" />
                      <span>Unsplash</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-48 lg:h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No image available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Routes Breakdown */}
            {route.routeData?.dailyRoutes &&
              route.routeData.dailyRoutes.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <span>Daily Route Breakdown</span>
                  </h3>

                  <div className="space-y-4">
                    {route.routeData.dailyRoutes.map((day, index) => (
                      <div
                        key={day.day || index}
                        className={`border-l-4 ${styles.borderAccent} pl-4 py-3 bg-gray-50 rounded-r-lg`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                          <h4 className="font-medium text-gray-900">
                            Day {day.day || index + 1}
                          </h4>
                          <span className="text-sm font-medium text-gray-600">
                            {day.distance || 0}km
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Start:</p>
                            <p className="font-medium text-gray-900">
                              {day.startPoint || "Not specified"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 mb-1">End:</p>
                            <p className="font-medium text-gray-900">
                              {day.endPoint || "Not specified"}
                            </p>
                          </div>
                        </div>

                        {day.waypoints && day.waypoints.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-600 mb-2">
                              Key waypoints:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {day.waypoints.map((waypoint, wpIndex) => (
                                <span
                                  key={wpIndex}
                                  className="inline-flex items-center space-x-1 bg-white px-2 py-1 rounded-md text-sm text-gray-700 border border-gray-200"
                                >
                                  <MapPin className="h-3 w-3" />
                                  <span>{waypoint}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Map and Weather Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Interactive Map */}
              <div className="xl:col-span-2">
                <MapDisplay
                  routeData={getRouteDataForMap()}
                  formData={getFormDataForMap()}
                />
              </div>

              {/* Current Weather */}
              <div className="xl:col-span-1">
                <WeatherDisplay location={getWeatherLocation()} />
              </div>
            </div>
          </div>
        </div>

        {/* Delete Loading Overlay */}
        {isDeleting && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <div className="text-center">
              <div className="loading-spinner mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Deleting Route
              </h3>
              <p className="text-gray-600">Please wait...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteDetailModal;
