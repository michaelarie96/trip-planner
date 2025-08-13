import { useState } from "react";
import { MapPin, Bike, Mountain, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { routesAPI } from "../../services/api";

/**
 * RouteForm Component
 * 
 * Handles user input for route generation:
 * - Country/city selection
 * - Trip type selection (cycling/trekking)
 * - Form validation and submission
 * - API integration with backend LLM service
 * - Loading states and error handling
 */
const RouteForm = ({ onRouteGenerated, isGenerating, setIsGenerating }) => {
  // Form state management
  const [formData, setFormData] = useState({
    country: "",
    city: "",
    tripType: "", // 'cycling' or 'trekking'
  });

  // Error and validation state
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    // Clear server error when user modifies form
    if (serverError) {
      setServerError("");
    }
  };

  // Handle trip type selection
  const handleTripTypeSelect = (type) => {
    setFormData((prev) => ({
      ...prev,
      tripType: type,
    }));

    // Clear trip type error
    if (errors.tripType) {
      setErrors((prev) => ({
        ...prev,
        tripType: "",
      }));
    }

    // Clear server error
    if (serverError) {
      setServerError("");
    }
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    // Country validation
    if (!formData.country.trim()) {
      newErrors.country = "Country is required";
    } else if (formData.country.trim().length < 2) {
      newErrors.country = "Country name must be at least 2 characters";
    }

    // Trip type validation
    if (!formData.tripType) {
      newErrors.tripType = "Please select a trip type";
    } else if (!["cycling", "trekking"].includes(formData.tripType)) {
      newErrors.tripType = "Invalid trip type selected";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setServerError("");

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsGenerating(true);

    try {
      console.log("Generating route with data:", formData);

      // Prepare API request data
      const requestData = {
        country: formData.country.trim(),
        tripType: formData.tripType,
      };

      // Add city if provided
      if (formData.city.trim()) {
        requestData.city = formData.city.trim();
      }

      // Call backend API to generate route
      const response = await routesAPI.generate(requestData);

      if (response.data && response.data.route) {
        console.log("Route generated successfully:", response.data.route);
        
        // Pass the generated route data to parent component
        onRouteGenerated({
          routeData: response.data.route,
          generationData: response.data.route.generationMetadata,
          imageData: response.data.route.imageData,
          formData: formData,
        });
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (error) {
      console.error("Route generation error:", error);
      console.error("Error response:", error.response);
      console.error("Error status:", error.response?.status);
      console.error("Error data:", error.response?.data);

      // Handle different types of errors
      let errorMessage;
      if (error.response?.status === 503) {
        errorMessage = "Route generation service is temporarily unavailable. Please try again in a few moments.";
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || "Invalid request. Please check your inputs.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = "Failed to generate route. Please try again.";
      }

      console.error("Setting error message:", errorMessage);
      setServerError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData({
      country: "",
      city: "",
      tripType: "",
    });
    setErrors({});
    setServerError("");
  };

  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-6">
      {/* Form Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-primary-600" />
          <span>Generate Your Route</span>
        </h2>
        <p className="text-gray-600 text-sm">
          Choose your destination and trip type, and let AI create the perfect route for you.
        </p>
      </div>

      {/* Server Error Display */}
      {serverError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 text-sm font-medium">Generation Failed</p>
            <p className="text-red-700 text-sm mt-1">{serverError}</p>
          </div>
        </div>
      )}

      {/* Route Generation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location Section */}
        <div className="space-y-4">
          <h3 className="text-base font-medium text-gray-900 flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-gray-600" />
            <span>Where do you want to go?</span>
          </h3>

          {/* Country Field */}
          <div>
            <label
              htmlFor="country"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Country / Region *
            </label>
            <input
              id="country"
              name="country"
              type="text"
              required
              value={formData.country}
              onChange={handleInputChange}
              className={`input-base ${
                errors.country
                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                  : ""
              }`}
              placeholder="e.g., France, Italy, Switzerland"
              disabled={isGenerating}
            />
            {errors.country && (
              <p className="mt-1 text-sm text-red-600">{errors.country}</p>
            )}
          </div>

          {/* City Field (Optional) */}
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              City / Starting Point{" "}
              <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleInputChange}
              className="input-base"
              placeholder="e.g., Paris, Rome, Zurich"
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-gray-500">
              Specify a city for more precise route recommendations
            </p>
          </div>
        </div>

        {/* Trip Type Section */}
        <div className="space-y-4">
          <h3 className="text-base font-medium text-gray-900">
            What type of adventure? *
          </h3>

          {/* Trip Type Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cycling Option */}
            <button
              type="button"
              onClick={() => handleTripTypeSelect("cycling")}
              disabled={isGenerating}
              className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                formData.tripType === "cycling"
                  ? "border-cycling-600 bg-cycling-50 ring-2 ring-cycling-600 ring-opacity-20"
                  : "border-gray-200 bg-white hover:border-cycling-300 hover:bg-cycling-50"
              } ${isGenerating ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    formData.tripType === "cycling"
                      ? "bg-cycling-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Bike className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">Cycling</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    2-day city-to-city cycling routes
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Max 60km per day</li>
                    <li>• Road and cycling path routes</li>
                    <li>• Multi-day adventure</li>
                  </ul>
                </div>
              </div>
            </button>

            {/* Trekking Option */}
            <button
              type="button"
              onClick={() => handleTripTypeSelect("trekking")}
              disabled={isGenerating}
              className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                formData.tripType === "trekking"
                  ? "border-trekking-600 bg-trekking-50 ring-2 ring-trekking-600 ring-opacity-20"
                  : "border-gray-200 bg-white hover:border-trekking-300 hover:bg-trekking-50"
              } ${isGenerating ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    formData.tripType === "trekking"
                      ? "bg-trekking-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Mountain className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">Trekking</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Circular hiking routes
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• 5-15km circular routes</li>
                    <li>• Hiking trails and paths</li>
                    <li>• Single day adventure</li>
                  </ul>
                </div>
              </div>
            </button>
          </div>

          {errors.tripType && (
            <p className="text-sm text-red-600">{errors.tripType}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isGenerating}
            className={`flex-1 flex justify-center items-center space-x-2 ${
              formData.tripType === "cycling"
                ? "btn-cycling"
                : formData.tripType === "trekking"
                ? "btn-trekking"
                : "btn-primary"
            } ${
              isGenerating
                ? "opacity-60 cursor-not-allowed"
                : ""
            }`}
          >
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            <Sparkles className="h-4 w-4" />
            <span>
              {isGenerating
                ? "Generating Route..."
                : "Generate AI Route"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isGenerating}
            className="btn-secondary sm:w-auto"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Tips for better routes:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Be specific with country names (e.g., "France" rather than "Europe")</li>
          <li>• Add a city for more targeted recommendations</li>
          <li>• Cycling routes connect different cities over 2 days</li>
          <li>• Trekking routes are circular, returning to the starting point</li>
        </ul>
      </div>
    </div>
  );
};

export default RouteForm;