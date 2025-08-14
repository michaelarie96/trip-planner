const axios = require("axios");

class RoutingService {
  constructor() {
    // OpenRouteService API configuration
    this.baseUrl = "https://api.openrouteservice.org/v2";
    this.apiKey = process.env.OPENROUTESERVICE_API_KEY;

    // Request headers for OpenRouteService
    this.headers = {
      Authorization: this.apiKey,
      "Content-Type": "application/json",
      Accept:
        "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
      "User-Agent": "TripPlanner-App/1.0",
    };

    // API usage tracking for free tier (2,000 requests/day)
    this.requestCount = 0;
    this.dailyLimit = 2000;

    if (!this.apiKey) {
      console.error(
        "OpenRouteService API key not found in environment variables"
      );
    }

    console.log("RoutingService initialized with OpenRouteService API");
  }

  /**
   * Get routing coordinates between waypoints using OpenRouteService
   * @param {Array} waypoints - Array of [lng, lat] coordinates (note: ORS uses lng,lat)
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {Object} options - Additional routing options
   * @returns {Array} Array of [lat, lng] coordinates following roads/trails
   */
  async getRouteCoordinates(waypoints, tripType = "cycling", options = {}) {
    try {
      console.log(
        `Getting route coordinates for ${tripType} with ${waypoints.length} waypoints`
      );

      // Check API key
      if (!this.apiKey) {
        throw new Error("OpenRouteService API key not configured");
      }

      // Check daily limit
      if (this.requestCount >= this.dailyLimit) {
        console.warn("Daily API limit reached, falling back to basic routing");
        throw new Error("Daily API limit reached");
      }

      // Convert waypoints to ORS format ([lng, lat])
      const orsWaypoints = waypoints.map((coord) => {
        // Input coordinates are [lat, lng], convert to [lng, lat] for ORS
        return [coord[1], coord[0]];
      });

      // Get routing profile based on trip type
      const profile = this.getRoutingProfile(tripType);

      // Prepare API request
      const requestData = {
        coordinates: orsWaypoints,
        format: "geojson",
        instructions: false,
        geometry_simplify: true,
        continue_straight: false,
        ...options,
      };

      console.log(`Making request to OpenRouteService ${profile} endpoint`);

      // Make API request
      const response = await axios.post(
        `${this.baseUrl}/directions/${profile}/geojson`,
        requestData,
        {
          headers: this.headers,
          timeout: 15000, // 15 second timeout
        }
      );

      // Increment request counter
      this.requestCount++;
      console.log(
        `OpenRouteService request ${this.requestCount}/${this.dailyLimit} completed`
      );

      // Process response
      const routeData = this.processOrsResponse(response.data, tripType);

      console.log(
        `Generated route with ${routeData.coordinates.length} coordinates`
      );
      return routeData;
    } catch (error) {
      console.error("OpenRouteService routing error:", error.message);

      // Handle specific error types
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        switch (status) {
          case 401:
            throw new Error("Invalid OpenRouteService API key");
          case 403:
            throw new Error(
              "OpenRouteService API access forbidden - check API key permissions"
            );
          case 404:
            throw new Error("Route not found - waypoints may be unreachable");
          case 429:
            throw new Error("OpenRouteService rate limit exceeded");
          case 500:
            throw new Error("OpenRouteService server error");
          default:
            throw new Error(
              `OpenRouteService API error: ${
                errorData?.error?.message || error.message
              }`
            );
        }
      }

      throw new Error(`Routing service error: ${error.message}`);
    }
  }

  /**
   * Get appropriate routing profile for trip type
   * @param {string} tripType - 'cycling' or 'trekking'
   * @returns {string} OpenRouteService profile name
   */
  getRoutingProfile(tripType) {
    const profiles = {
      cycling: "cycling-regular", // Regular cycling routes
      trekking: "foot-hiking", // Hiking/walking routes
      walking: "foot-walking", // Alternative for trekking
    };

    return profiles[tripType] || profiles.cycling;
  }

  /**
   * Process OpenRouteService response and extract coordinates
   * @param {Object} orsResponse - Raw OpenRouteService response
   * @param {string} tripType - Trip type for additional processing
   * @returns {Object} Processed route data
   */
  processOrsResponse(orsResponse, tripType) {
    try {
      if (!orsResponse.features || orsResponse.features.length === 0) {
        throw new Error("No route features found in OpenRouteService response");
      }

      const feature = orsResponse.features[0];
      const geometry = feature.geometry;

      if (!geometry || !geometry.coordinates) {
        throw new Error("Invalid geometry in OpenRouteService response");
      }

      // Extract coordinates and convert from [lng, lat] to [lat, lng]
      const coordinates = geometry.coordinates.map((coord) => [
        coord[1],
        coord[0],
      ]);

      // Extract route properties
      const properties = feature.properties;
      const summary = properties.summary || {};

      const routeData = {
        coordinates: coordinates,
        distance: summary.distance
          ? Math.round((summary.distance / 1000) * 100) / 100
          : 0, // Convert to km
        duration: summary.duration ? Math.round(summary.duration / 60) : 0, // Convert to minutes
        ascent: properties.ascent || 0,
        descent: properties.descent || 0,
        difficulty: this.calculateDifficulty(summary, tripType),
        source: "OpenRouteService",
        profile: this.getRoutingProfile(tripType),
        generatedAt: new Date().toISOString(),
      };

      console.log(
        `Processed route: ${routeData.distance}km, ${routeData.duration}min`
      );
      return routeData;
    } catch (error) {
      console.error("Error processing OpenRouteService response:", error);
      throw new Error(`Failed to process routing response: ${error.message}`);
    }
  }

  /**
   * Calculate route difficulty based on distance, duration, and elevation
   * @param {Object} summary - Route summary from OpenRouteService
   * @param {string} tripType - Trip type
   * @returns {string} Difficulty level: 'easy', 'moderate', 'hard'
   */
  calculateDifficulty(summary, tripType) {
    const distance = summary.distance ? summary.distance / 1000 : 0; // Convert to km
    const duration = summary.duration ? summary.duration / 3600 : 0; // Convert to hours

    if (tripType === "cycling") {
      // Cycling difficulty based on distance and speed
      if (distance < 30 && duration < 2) return "easy";
      if (distance < 60 && duration < 4) return "moderate";
      return "hard";
    } else {
      // Trekking difficulty based on distance and terrain
      if (distance < 8 && duration < 3) return "easy";
      if (distance < 15 && duration < 6) return "moderate";
      return "hard";
    }
  }

  /**
   * Get multiple route alternatives (if supported by the profile)
   * @param {Array} waypoints - Array of [lat, lng] coordinates
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {number} alternatives - Number of alternative routes (max 3)
   * @returns {Array} Array of route alternatives
   */
  async getRouteAlternatives(
    waypoints,
    tripType = "cycling",
    alternatives = 2
  ) {
    try {
      const orsWaypoints = waypoints.map((coord) => [coord[1], coord[0]]);
      const profile = this.getRoutingProfile(tripType);

      const requestData = {
        coordinates: orsWaypoints,
        format: "geojson",
        instructions: false,
        alternative_routes: {
          target_count: Math.min(alternatives, 3),
          weight_factor: 1.4,
          share_factor: 0.6,
        },
      };

      const response = await axios.post(
        `${this.baseUrl}/directions/${profile}/geojson`,
        requestData,
        {
          headers: this.headers,
          timeout: 20000,
        }
      );

      this.requestCount++;

      const routes = [];
      if (response.data.features) {
        for (const feature of response.data.features) {
          try {
            const routeData = this.processOrsResponse(
              { features: [feature] },
              tripType
            );
            routes.push(routeData);
          } catch (error) {
            console.warn("Failed to process route alternative:", error.message);
          }
        }
      }

      console.log(`Generated ${routes.length} route alternatives`);
      return routes;
    } catch (error) {
      console.error("Error getting route alternatives:", error.message);
      // Fall back to single route
      return [await this.getRouteCoordinates(waypoints, tripType)];
    }
  }

  /**
   * Create a circular route for trekking (starting and ending at same point)
   * @param {Array} startPoint - [lat, lng] starting coordinates
   * @param {number} distanceKm - Desired route distance in kilometers
   * @param {string} direction - 'clockwise' or 'counterclockwise'
   * @returns {Object} Circular route data
   */
  async getCircularRoute(startPoint, distanceKm = 10, direction = "clockwise") {
    try {
      console.log(
        `Creating circular route from ${startPoint} with ${distanceKm}km distance`
      );

      // Generate waypoints for a circular route
      const waypoints = this.generateCircularWaypoints(
        startPoint,
        distanceKm,
        direction
      );

      // Get route through all waypoints
      const routeData = await this.getRouteCoordinates(waypoints, "trekking");

      // Ensure route ends at starting point
      if (routeData.coordinates.length > 0) {
        const lastCoord =
          routeData.coordinates[routeData.coordinates.length - 1];
        const startCoord = routeData.coordinates[0];

        // If route doesn't end close to start, add the starting point
        const distance = this.calculateDistance(lastCoord, startCoord);
        if (distance > 0.1) {
          // More than 100m apart
          routeData.coordinates.push(startCoord);
        }
      }

      console.log(
        `Generated circular route with ${routeData.coordinates.length} coordinates`
      );
      return routeData;
    } catch (error) {
      console.error("Error creating circular route:", error.message);
      throw error;
    }
  }

  /**
   * Generate waypoints for a circular route
   * @param {Array} center - [lat, lng] center coordinates
   * @param {number} distanceKm - Target distance in kilometers
   * @param {string} direction - Route direction
   * @returns {Array} Array of waypoint coordinates
   */
  generateCircularWaypoints(center, distanceKm, direction = "clockwise") {
    const waypoints = [center]; // Start at center

    // Calculate radius based on desired distance (approximate)
    const radiusKm = (distanceKm / (2 * Math.PI)) * 1.5; // Factor for more realistic paths

    // Convert radius to degrees
    const radiusLat = radiusKm / 111.0;
    const radiusLng =
      radiusKm / (111.0 * Math.cos((center[0] * Math.PI) / 180));

    // Generate 4-6 waypoints around the circle
    const numWaypoints = 5;
    const angleStep = (2 * Math.PI) / numWaypoints;
    const startAngle = Math.random() * 2 * Math.PI; // Random starting angle

    for (let i = 1; i <= numWaypoints; i++) {
      let angle = startAngle + angleStep * i;

      // Reverse angle for counterclockwise
      if (direction === "counterclockwise") {
        angle = startAngle - angleStep * i;
      }

      const lat = center[0] + radiusLat * Math.sin(angle);
      const lng = center[1] + radiusLng * Math.cos(angle);

      waypoints.push([lat, lng]);
    }

    // Return to start
    waypoints.push(center);

    return waypoints;
  }

  /**
   * Calculate distance between two coordinates
   * @param {Array} coord1 - [lat, lng]
   * @param {Array} coord2 - [lat, lng]
   * @returns {number} Distance in kilometers
   */
  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((coord2[0] - coord1[0]) * Math.PI) / 180;
    const dLng = ((coord2[1] - coord1[1]) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1[0] * Math.PI) / 180) *
        Math.cos((coord2[0] * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get API usage statistics
   * @returns {Object} Usage information
   */
  getUsageStats() {
    return {
      requestsUsed: this.requestCount,
      dailyLimit: this.dailyLimit,
      remaining: this.dailyLimit - this.requestCount,
      percentageUsed: Math.round((this.requestCount / this.dailyLimit) * 100),
      hasApiKey: !!this.apiKey,
    };
  }

  /**
   * Reset daily request counter (for testing or new day)
   */
  resetDailyCounter() {
    this.requestCount = 0;
    console.log("Daily request counter reset");
  }

  /**
   * Check if routing service is available and configured
   * @returns {boolean} True if service is ready to use
   */
  isAvailable() {
    return !!this.apiKey && this.requestCount < this.dailyLimit;
  }
}

module.exports = new RoutingService();
