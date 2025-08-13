import { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Loader2,
  AlertCircle,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { weatherAPI } from "../../services/api";

/**
 * Get weather icon based on condition
 */
const getWeatherIcon = (condition) => {
  const iconMap = {
    Clear: Sun,
    Clouds: Cloud,
    Rain: CloudRain,
    Drizzle: CloudRain,
    Snow: CloudSnow,
    Thunderstorm: CloudRain,
    Mist: Cloud,
    Fog: Cloud,
    Haze: Cloud,
  };

  const IconComponent = iconMap[condition] || Cloud;
  return IconComponent;
};

/**
 * Get weather condition styling
 */
const getWeatherStyling = (condition) => {
  const styleMap = {
    Clear: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
    Clouds: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" },
    Rain: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
    Drizzle: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
    Snow: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
    Thunderstorm: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  };

  return styleMap[condition] || { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" };
};

/**
 * WeatherDisplay Component
 * 
 * Displays 3-day weather forecast for route location:
 * - Fetches weather data from backend API
 * - Shows daily forecasts with icons and details
 * - Handles loading states and errors
 * - Provides refresh functionality
 * - Responsive card layout
 */
const WeatherDisplay = ({ location, routeId = null, className = "" }) => {
  // Weather data state
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch weather data
  const fetchWeather = useCallback(async () => {
    if (!location && !routeId) {
      setError("No location or route specified for weather");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log("Fetching weather for:", location || `route ${routeId}`);

      let response;
      if (routeId) {
        // Fetch weather for saved route
        response = await weatherAPI.getRouteWeather(routeId);
      } else {
        // Fetch weather for location string
        response = await weatherAPI.getForecast(location);
      }

      if (response.data && response.data.weather) {
        console.log("Weather data received:", response.data.weather);
        setWeatherData(response.data.weather);
        setLastUpdated(new Date());
      } else {
        throw new Error("Invalid weather data format");
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
      
      let errorMessage;
      if (error.response?.status === 404) {
        errorMessage = "Weather data not available for this location";
      } else if (error.response?.status === 429) {
        errorMessage = "Weather service rate limit exceeded. Please try again later.";
      } else if (error.response?.status === 503) {
        errorMessage = "Weather service temporarily unavailable";
      } else {
        errorMessage = error.response?.data?.message || "Failed to load weather data";
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [location, routeId]);

  // Fetch weather on component mount or when location changes
  useEffect(() => {
    if (location || routeId) {
      fetchWeather();
    }
  }, [location, routeId, fetchWeather]);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchWeather();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-soft border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            <span className="text-gray-600">Loading weather forecast...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-white rounded-xl shadow-soft border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-6">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Weather Unavailable
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!weatherData) {
    return (
      <div className={`bg-white rounded-xl shadow-soft border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-6 text-gray-500">
          <Cloud className="h-8 w-8 mx-auto mb-2" />
          <p>No weather data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-soft border border-gray-200 overflow-hidden ${className}`}>
      {/* Weather Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Cloud className="h-5 w-5 text-gray-600" />
              <span>3-Day Weather Forecast</span>
            </h3>
            {weatherData.location && (
              <div className="flex items-center space-x-1 mt-1 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>
                  {weatherData.location.name}
                  {weatherData.location.country && `, ${weatherData.location.country}`}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              title="Refresh weather"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Weather Forecast Grid */}
      {weatherData.forecast && weatherData.forecast.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {weatherData.forecast.map((day, index) => {
            const WeatherIcon = getWeatherIcon(day.weather.condition);
            const styling = getWeatherStyling(day.weather.condition);
            
            return (
              <div key={day.date || index} className="p-4 md:p-6">
                {/* Day Header */}
                <div className="text-center mb-3">
                  <h4 className="font-medium text-gray-900">
                    {index === 0 ? "Tomorrow" : day.dayName || `Day ${index + 1}`}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {day.date ? new Date(day.date).toLocaleDateString([], { 
                      month: 'short', 
                      day: 'numeric' 
                    }) : ''}
                  </p>
                </div>

                {/* Weather Icon and Condition */}
                <div className="text-center mb-3">
                  <div className={`inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full ${styling.bg} ${styling.border} border-2 mb-2`}>
                    <WeatherIcon className={`h-6 w-6 md:h-8 md:w-8 ${styling.text}`} />
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {day.weather.description}
                  </p>
                </div>

                {/* Temperature */}
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <Thermometer className="h-4 w-4 text-gray-600" />
                    <span className="text-xl md:text-2xl font-semibold text-gray-900">
                      {day.weather.temperature.current || day.weather.temperature.max}°C
                    </span>
                  </div>
                  {day.weather.temperature.min !== day.weather.temperature.max && (
                    <p className="text-sm text-gray-600">
                      {day.weather.temperature.min}° - {day.weather.temperature.max}°
                    </p>
                  )}
                  {day.weather.temperature.feelsLike && (
                    <p className="text-xs text-gray-500">
                      Feels like {day.weather.temperature.feelsLike}°
                    </p>
                  )}
                </div>

                {/* Weather Details */}
                <div className="space-y-2">
                  {/* Wind */}
                  {day.weather.windSpeed && (
                    <div className="flex items-center justify-between text-xs md:text-sm py-1">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Wind className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        <span>Wind</span>
                      </div>
                      <span className="text-gray-900 font-medium text-right">
                        {day.weather.windSpeed}<span className="text-xs"> km/h</span>
                      </span>
                    </div>
                  )}

                  {/* Humidity */}
                  {day.weather.humidity && (
                    <div className="flex items-center justify-between text-xs md:text-sm py-1">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Droplets className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        <span>Humidity</span>
                      </div>
                      <span className="text-gray-900 font-medium text-right">
                        {day.weather.humidity}<span className="text-xs">%</span>
                      </span>
                    </div>
                  )}

                  {/* Cloudiness */}
                  {day.weather.cloudiness !== undefined && (
                    <div className="flex items-center justify-between text-xs md:text-sm py-1">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Eye className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        <span>Clouds</span>
                      </div>
                      <span className="text-gray-900 font-medium text-right">
                        {day.weather.cloudiness}<span className="text-xs">%</span>
                      </span>
                    </div>
                  )}

                  {/* Precipitation */}
                  {day.weather.precipitation > 0 && (
                    <div className="flex items-center justify-between text-xs md:text-sm py-1">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <CloudRain className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        <span>Rain</span>
                      </div>
                      <span className="text-gray-900 font-medium text-right">
                        {day.weather.precipitation}<span className="text-xs">mm</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center text-gray-500">
          <p>No forecast data available</p>
        </div>
      )}

      {/* Weather Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Weather data provided by OpenWeatherMap • Updates every hour
        </p>
      </div>
    </div>
  );
};

export default WeatherDisplay;