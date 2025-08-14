import { useState } from "react";
import {
  MapPin,
  Clock,
  Route,
  Mountain,
  Bike,
  Calendar,
  Star,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import { routesAPI } from "../../services/api";

/**
 * RouteDisplay Component
 *
 * Displays generated route information including:
 * - Route summary (distance, duration, difficulty)
 * - Daily route breakdown with waypoints
 * - Country image (if available)
 * - Save route functionality
 * - Visual styling based on trip type
 */
const RouteDisplay = ({ routeData, formData, onRouteSaved }) => {
  // Save functionality state
  const [isSaving, setSaySaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Save form data
  const [saveFormData, setSaveFormData] = useState({
    name: "",
    description: "",
  });

  // Debug and validate route data
  console.log("=== RouteDisplay Debug Info ===");
  console.log("Received routeData:", routeData);
  console.log("Received formData:", formData);

  if (!routeData) {
    console.log("❌ No routeData provided to RouteDisplay");
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>No route data available</p>
        </div>
      </div>
    );
  }

  if (!formData) {
    console.log("❌ No formData provided to RouteDisplay");
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>No form data available</p>
        </div>
      </div>
    );
  }

  // Extract route data - check multiple possible structures
  let route = null;
  let imageData = null;
  let generationData = null;

  // Try different data structures from API response
  if (routeData.routeData && routeData.routeData.routeData) {
    // Structure: { routeData: { routeData: {...} }, imageData: {...}, generationData: {...} }
    route = routeData.routeData.routeData;
    imageData = routeData.imageData;
    generationData = routeData.generationData;
    console.log("✅ Using nested routeData.routeData.routeData structure");
  } else if (routeData.routeData) {
    // Structure: { routeData: {...}, imageData: {...}, generationData: {...} }
    route = routeData.routeData;
    imageData = routeData.imageData;
    generationData = routeData.generationData;
    console.log("✅ Using routeData.routeData structure");
  } else if (routeData.route) {
    // Structure: { route: {...} }
    route = routeData.route;
    console.log("✅ Using routeData.route structure");
  } else {
    // Structure: direct route data
    route = routeData;
    console.log("✅ Using direct routeData structure");
  }

  console.log("Extracted route:", route);
  console.log("Route keys:", route ? Object.keys(route) : "No route");
  console.log("Daily routes:", route?.dailyRoutes);
  console.log("Total distance:", route?.totalDistance);

  if (!route) {
    console.log("❌ Could not extract route data from any known structure");
    return (
      <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Data Structure Issue
          </h3>
          <p className="text-gray-600 mb-4">
            Unable to extract route data from the response
          </p>
          <details className="text-left bg-gray-50 p-4 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
              Show Debug Information
            </summary>
            <div className="text-xs text-gray-600 space-y-2">
              <div>
                <strong>RouteData keys:</strong>{" "}
                {Object.keys(routeData).join(", ")}
              </div>
              <div>
                <strong>RouteData structure:</strong>
                <pre className="mt-1 p-2 bg-gray-100 rounded overflow-auto max-h-32">
                  {JSON.stringify(routeData, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // Get trip type styling
  const getTripTypeStyles = () => {
    if (formData.tripType === "cycling") {
      return {
        primary: "text-cycling-700",
        bg: "bg-cycling-50",
        border: "border-cycling-200",
        badge: "badge-cycling",
        icon: Bike,
        borderLeft: "border-l-cycling-600",
      };
    } else {
      return {
        primary: "text-trekking-700",
        bg: "bg-trekking-50",
        border: "border-trekking-200",
        badge: "badge-trekking",
        icon: Mountain,
        borderLeft: "border-l-trekking-600",
      };
    }
  };

  const styles = getTripTypeStyles();
  const TripIcon = styles.icon;

  // Handle save form input changes
  const handleSaveInputChange = (e) => {
    const { name, value } = e.target;
    setSaveFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear errors when user types
    if (saveError) {
      setSaveError("");
    }
  };

  // Handle route saving
  const handleSaveRoute = async (e) => {
    e.preventDefault();

    // Validate save form
    if (!saveFormData.name.trim()) {
      setSaveError("Route name is required");
      return;
    }

    setSaySaving(true);
    setSaveError("");

    try {
      console.log("Saving route...");

      // Prepare route data for saving
      const saveData = {
        name: saveFormData.name.trim(),
        description: saveFormData.description.trim(),
        country: formData.country,
        city: formData.city || null,
        tripType: formData.tripType,
        routeData: route,
        imageUrl: imageData?.imageUrl || null,
        generationData: generationData || null,
      };

      const response = await routesAPI.save(saveData);

      if (response.data && response.data.saved) {
        console.log("Route saved successfully:", response.data.route);
        setSaveSuccess(true);
        setShowSaveForm(false);

        // Call parent callback if provided
        if (onRouteSaved) {
          onRouteSaved(response.data.route);
        }

        // Reset save form
        setSaveFormData({ name: "", description: "" });

        // Show success message briefly
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        throw new Error("Failed to save route");
      }
    } catch (error) {
      console.error("Save route error:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to save route. Please try again.";
      setSaveError(errorMessage);
    } finally {
      setSaySaving(false);
    }
  };

  // Cancel save form
  const handleCancelSave = () => {
    setShowSaveForm(false);
    setSaveFormData({ name: "", description: "" });
    setSaveError("");
  };

  // Safely get route statistics with fallbacks
  const getRouteStats = () => {
    const totalDistance = route.totalDistance || 0;
    const estimatedDuration =
      route.estimatedDuration ||
      (formData.tripType === "cycling" ? "2 days" : "1 day");
    const dayCount =
      route.dailyRoutes?.length || (formData.tripType === "cycling" ? 2 : 1);

    return { totalDistance, estimatedDuration, dayCount };
  };

  const { totalDistance, estimatedDuration, dayCount } = getRouteStats();

  return (
    <div className="space-y-6">
      {/* Route Header with Image */}
      <div className={`${styles.bg} ${styles.border} rounded-xl p-6 border`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Route Summary */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div
                className={`w-10 h-10 ${styles.bg} rounded-lg flex items-center justify-center`}
              >
                <TripIcon className={`h-5 w-5 ${styles.primary}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {formData.city
                    ? `${formData.city}, ${formData.country}`
                    : formData.country}{" "}
                  Route
                </h2>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={styles.badge}>
                    {formData.tripType.charAt(0).toUpperCase() +
                      formData.tripType.slice(1)}
                  </span>
                  {route.difficulty && (
                    <span className="badge-neutral">{route.difficulty}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Route Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Route className="h-4 w-4 text-gray-600" />
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {totalDistance}km
                </p>
                <p className="text-sm text-gray-600">Total Distance</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Clock className="h-4 w-4 text-gray-600" />
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {estimatedDuration}
                </p>
                <p className="text-sm text-gray-600">Duration</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Calendar className="h-4 w-4 text-gray-600" />
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {dayCount}
                </p>
                <p className="text-sm text-gray-600">
                  {dayCount === 1 ? "Day" : "Days"}
                </p>
              </div>
            </div>
          </div>

          {/* Country Image */}
          <div className="lg:col-span-1">
            {imageData?.imageUrl ? (
              <div className="relative">
                <img
                  src={imageData.imageUrl}
                  alt={imageData.description || `${formData.country} landscape`}
                  className="w-full h-48 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
                <div className="hidden w-full h-48 bg-gray-100 rounded-lg items-center justify-center">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Image unavailable</p>
                  </div>
                </div>
                {imageData.photographer && (
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                    Photo by {imageData.photographer.name}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No image available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Routes Breakdown */}
      <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <span>Route Breakdown</span>
        </h3>

        <div className="space-y-4">
          {route.dailyRoutes && route.dailyRoutes.length > 0 ? (
            // Display actual daily routes
            route.dailyRoutes.map((day, index) => (
              <div
                key={day.day || index}
                className={`border-l-4 ${styles.borderLeft} pl-4 py-3 bg-gray-50 rounded-r-lg`}
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
                    <p className="text-sm text-gray-600 mb-2">Key waypoints:</p>
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
            ))
          ) : (
            // Fallback display with debug information
            <div className="text-center py-8">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-yellow-800 mb-2">
                  ⚠️ Missing Daily Route Data
                </h4>
                <div className="text-left text-sm text-yellow-700 space-y-1">
                  <p>
                    <strong>Expected:</strong> route.dailyRoutes array with day
                    objects
                  </p>
                  <p>
                    <strong>Found:</strong>{" "}
                    {route.dailyRoutes
                      ? `${route.dailyRoutes.length} items`
                      : "undefined or empty"}
                  </p>
                  <p>
                    <strong>Route Keys:</strong> {Object.keys(route).join(", ")}
                  </p>
                </div>
              </div>

              {/* Try to show some route info if available */}
              {route.coordinates && route.coordinates.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-blue-800 mb-2">
                    Available Route Data
                  </h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>📍 {route.coordinates.length} coordinate points</p>
                    {route.waypoints && (
                      <p>🗺️ {route.waypoints.length} waypoints</p>
                    )}
                    <p>📏 Total distance: {totalDistance}km</p>
                    <p>⏱️ Duration: {estimatedDuration}</p>
                  </div>
                </div>
              )}

              {/* Raw data display for debugging */}
              <details className="text-left">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 mb-2">
                  🔍 Show Raw Route Data (for debugging)
                </summary>
                <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40 text-left">
                  {JSON.stringify(route, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Save Route Section */}
      <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-6">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-green-800 text-sm font-medium">
              Route saved successfully! You can find it in your route history.
            </p>
          </div>
        )}

        {!showSaveForm ? (
          /* Save Button */
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Save This Route
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Save this route to your account to access it later and get weather
              updates.
            </p>
            <button
              onClick={() => setShowSaveForm(true)}
              className="btn-primary inline-flex items-center space-x-2"
              disabled={saveSuccess}
            >
              <Save className="h-4 w-4" />
              <span>Save Route</span>
            </button>
          </div>
        ) : (
          /* Save Form */
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Save Your Route
            </h3>

            {/* Save Error */}
            {saveError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm">{saveError}</p>
              </div>
            )}

            <form onSubmit={handleSaveRoute} className="space-y-4">
              <div>
                <label
                  htmlFor="routeName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Route Name *
                </label>
                <input
                  id="routeName"
                  name="name"
                  type="text"
                  required
                  value={saveFormData.name}
                  onChange={handleSaveInputChange}
                  className="input-base"
                  placeholder="e.g., Tuscany Cycling Adventure"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label
                  htmlFor="routeDescription"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Description{" "}
                  <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <textarea
                  id="routeDescription"
                  name="description"
                  rows={3}
                  value={saveFormData.description}
                  onChange={handleSaveInputChange}
                  className="input-base resize-none"
                  placeholder="Describe your route experience, highlights, or notes for future reference..."
                  disabled={isSaving}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`flex-1 flex justify-center items-center space-x-2 ${
                    formData.tripType === "cycling"
                      ? "btn-cycling"
                      : "btn-trekking"
                  } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? "Saving..." : "Save Route"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelSave}
                  disabled={isSaving}
                  className="btn-secondary sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteDisplay;
