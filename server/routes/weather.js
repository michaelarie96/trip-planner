const express = require("express");
const weatherService = require("../services/weatherService");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Apply authentication middleware to all weather endpoints
router.use(authenticateToken);

/**
 * Get 3-day weather forecast for a location
 * Location can be city name or "lat,lon" coordinates
 */
router.get("/forecast/:location", async (req, res) => {
  try {
    const { location } = req.params;

    // Validate location parameter
    if (!location || location.trim() === "") {
      return res.status(400).json({
        message: "Location parameter is required",
        example:
          "Use city name like 'Paris' or coordinates like '48.8566,2.3522'",
      });
    }

    console.log(
      `Weather forecast requested for: ${location} by user: ${req.user.name}`
    );

    // Get weather forecast from service
    const weatherData = await weatherService.getWeatherForecast(
      location.trim()
    );

    res.json({
      message: "Weather forecast retrieved successfully",
      weather: weatherData,
      requestedLocation: location,
    });
  } catch (error) {
    console.error("Weather forecast error:", error.message);

    // Return appropriate error response
    if (error.message.includes("Invalid weather API key")) {
      return res.status(503).json({
        message: "Weather service temporarily unavailable",
        error: "API configuration issue",
      });
    }

    if (error.message.includes("Location not found")) {
      return res.status(404).json({
        message: "Location not found",
        error: "Please check the location name and try again",
        requestedLocation: req.params.location,
      });
    }

    if (error.message.includes("rate limit")) {
      return res.status(429).json({
        message: "Weather service rate limit exceeded",
        error: "Please try again in a few minutes",
      });
    }

    // Generic error response
    res.status(500).json({
      message: "Error retrieving weather forecast",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Weather service error",
    });
  }
});

// Get current weather for a location
router.get("/current/:location", async (req, res) => {
  try {
    const { location } = req.params;

    if (!location || location.trim() === "") {
      return res.status(400).json({
        message: "Location parameter is required",
      });
    }

    console.log(
      `Current weather requested for: ${location} by user: ${req.user.name}`
    );

    // Get current weather from service
    const weatherData = await weatherService.getCurrentWeather(location.trim());

    res.json({
      message: "Current weather retrieved successfully",
      weather: weatherData,
      requestedLocation: location,
    });
  } catch (error) {
    console.error("Current weather error:", error.message);

    // Same error handling as forecast endpoint
    if (error.message.includes("Invalid weather API key")) {
      return res.status(503).json({
        message: "Weather service temporarily unavailable",
        error: "API configuration issue",
      });
    }

    if (error.message.includes("Location not found")) {
      return res.status(404).json({
        message: "Location not found",
        error: "Please check the location name and try again",
      });
    }

    res.status(500).json({
      message: "Error retrieving current weather",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Weather service error",
    });
  }
});

// Get weather for a saved route's starting location
router.get("/route/:routeId", async (req, res) => {
  try {
    const { routeId } = req.params;

    // Validate MongoDB ObjectId format
    if (!routeId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid route ID format",
      });
    }

    // Import Route model (we need it for this endpoint)
    const Route = require("../models/route");

    // Find the route and verify ownership
    const route = await Route.findOne({
      _id: routeId,
      userId: req.user._id,
    });

    if (!route) {
      return res.status(404).json({
        message: "Route not found or access denied",
      });
    }

    // Determine location for weather lookup
    let location;

    if (
      route.weatherLocation &&
      route.weatherLocation.coordinates &&
      route.weatherLocation.coordinates.length === 2
    ) {
      // Use stored weather coordinates
      const [lat, lon] = route.weatherLocation.coordinates;
      location = `${lat},${lon}`;
    } else if (
      route.routeData.coordinates &&
      route.routeData.coordinates.length > 0
    ) {
      // Use first route coordinate
      const [lat, lon] = route.routeData.coordinates[0];
      location = `${lat},${lon}`;
    } else if (route.city && route.country) {
      // Use city, country
      location = `${route.city}, ${route.country}`;
    } else {
      // Use just country
      location = route.country;
    }

    console.log(
      `Weather requested for route "${route.name}" at location: ${location}`
    );

    // Get weather forecast
    const weatherData = await weatherService.getWeatherForecast(location);

    res.json({
      message: "Weather forecast retrieved for route",
      weather: weatherData,
      route: {
        id: route._id,
        name: route.name,
        location:
          route.weatherLocation?.locationName ||
          `${route.city || route.country}`,
      },
    });
  } catch (error) {
    console.error("Route weather error:", error.message);

    if (error.message.includes("Location not found")) {
      return res.status(404).json({
        message: "Weather not available for route location",
        error: "Unable to find weather data for this route's location",
      });
    }

    res.status(500).json({
      message: "Error retrieving weather for route",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Weather service error",
    });
  }
});

module.exports = router;
