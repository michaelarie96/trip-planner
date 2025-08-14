const axios = require("axios");

class GeocodingService {
  constructor() {
    // Google Geocoding API configuration (primary)
    this.googleApiKey = process.env.GOOGLE_GEOCODING_API_KEY;
    this.googleBaseUrl = "https://maps.googleapis.com/maps/api/geocode/json";

    // OpenStreetMap Nominatim API (fallback)
    this.nominatimBaseUrl = "https://nominatim.openstreetmap.org";

    // Request headers for Nominatim (required by Nominatim)
    this.nominatimHeaders = {
      "User-Agent": "TripPlanner-App/1.0 (contact@example.com)",
      Accept: "application/json",
    };

    // Cache for geocoding results to avoid repeated API calls
    this.geocodeCache = new Map();

    // API usage tracking
    this.googleRequestCount = 0;
    this.nominatimRequestCount = 0;
    this.cacheHits = 0;

    if (!this.googleApiKey) {
      console.warn(
        "Google Geocoding API key not found - will use Nominatim only"
      );
    } else {
      console.log(
        "✓ Google Geocoding API initialized as primary geocoding service"
      );
    }
  }

  /**
   * Geocode a location using Google API first, then Nominatim fallback
   * @param {string} location - Location string like "Paris, France" or "France"
   * @returns {Object} Coordinates and location info
   */
  async geocodeLocation(location) {
    try {
      // Check cache first
      const cacheKey = location.toLowerCase().trim();
      if (this.geocodeCache.has(cacheKey)) {
        console.log(`🎯 Cache hit for: ${location}`);
        this.cacheHits++;
        return this.geocodeCache.get(cacheKey);
      }

      console.log(`🔍 Geocoding location: ${location}`);

      let locationData = null;
      let method = "unknown";

      // Try Google Geocoding API first
      if (this.googleApiKey) {
        try {
          console.log(`📍 Attempting Google Geocoding for: ${location}`);
          locationData = await this.geocodeWithGoogle(location);
          method = "google";
          console.log(`✅ Google Geocoding successful for: ${location}`);
        } catch (googleError) {
          console.warn(
            `⚠️ Google Geocoding failed for "${location}": ${googleError.message}`
          );

          // Check if it's a quota/billing issue vs location not found
          if (
            googleError.message.includes("OVER_QUERY_LIMIT") ||
            googleError.message.includes("REQUEST_DENIED")
          ) {
            console.warn(
              "🚨 Google API quota/billing issue - switching to Nominatim"
            );
          }
        }
      }

      // Fallback to Nominatim if Google failed or not available
      if (!locationData) {
        try {
          console.log(`🗺️ Falling back to Nominatim for: ${location}`);
          locationData = await this.geocodeWithNominatim(location);
          method = "nominatim";
          console.log(`✅ Nominatim geocoding successful for: ${location}`);
        } catch (nominatimError) {
          console.error(
            `❌ Nominatim also failed for "${location}": ${nominatimError.message}`
          );
          throw new Error(`All geocoding services failed for "${location}"`);
        }
      }

      // Add metadata
      locationData.geocodingMethod = method;
      locationData.cachedAt = new Date().toISOString();

      // Cache the result
      this.geocodeCache.set(cacheKey, locationData);

      console.log(
        `📍 Geocoded "${location}" via ${method}:`,
        locationData.coordinates
      );
      return locationData;
    } catch (error) {
      console.error(`Geocoding error for "${location}":`, error.message);
      throw new Error(`Failed to geocode location: ${error.message}`);
    }
  }

  /**
   * Geocode using Google Geocoding API
   * @param {string} location - Location to geocode
   * @returns {Object} Geocoding result
   */
  async geocodeWithGoogle(location) {
    try {
      const response = await axios.get(this.googleBaseUrl, {
        params: {
          address: location,
          key: this.googleApiKey,
          language: "en", // Request English responses
          region: "us", // Bias towards US region for better international results
        },
        timeout: 10000, // 10 second timeout
        headers: {
          "User-Agent": "TripPlanner-App/1.0",
        },
      });

      this.googleRequestCount++;
      console.log(`📊 Google API request ${this.googleRequestCount} completed`);

      // Check API response status
      if (response.data.status !== "OK") {
        const errorMessage = this.handleGoogleError(
          response.data.status,
          response.data.error_message
        );
        throw new Error(errorMessage);
      }

      if (!response.data.results || response.data.results.length === 0) {
        throw new Error(
          `No results found for "${location}" in Google Geocoding`
        );
      }

      // Process Google's response format
      const result = response.data.results[0];
      const geometry = result.geometry;
      const coordinates = [geometry.location.lat, geometry.location.lng];

      return {
        coordinates,
        displayName: result.formatted_address,
        address: this.parseGoogleAddressComponents(result.address_components),
        boundingBox: geometry.viewport
          ? [
              geometry.viewport.southwest.lat,
              geometry.viewport.southwest.lng,
              geometry.viewport.northeast.lat,
              geometry.viewport.northeast.lng,
            ]
          : null,
        type: result.types[0] || "unknown",
        placeId: result.place_id,
        importance: this.calculateImportanceFromTypes(result.types),
        source: "Google Geocoding API",
        accuracy: geometry.location_type || "APPROXIMATE",
      };
    } catch (error) {
      if (error.response) {
        throw new Error(
          `Google API error: ${error.response.status} - ${error.response.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Geocode using Nominatim (OpenStreetMap) as fallback
   * @param {string} location - Location to geocode
   * @returns {Object} Geocoding result
   */
  async geocodeWithNominatim(location) {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: location,
          format: "json",
          limit: 1,
          addressdetails: 1,
          extratags: 1,
        },
        headers: this.nominatimHeaders,
        timeout: 10000,
      });

      this.nominatimRequestCount++;
      console.log(
        `📊 Nominatim request ${this.nominatimRequestCount} completed`
      );

      if (!response.data || response.data.length === 0) {
        throw new Error(`No results found for "${location}" in Nominatim`);
      }

      const result = response.data[0];
      const coordinates = [parseFloat(result.lat), parseFloat(result.lon)];

      return {
        coordinates,
        displayName: result.display_name,
        address: result.address || {},
        boundingBox: result.boundingbox ? result.boundingbox.map(Number) : null,
        type: result.type,
        importance: result.importance || 0.5,
        source: "Nominatim (OpenStreetMap)",
        accuracy: "APPROXIMATE",
      };
    } catch (error) {
      if (error.response) {
        throw new Error(
          `Nominatim API error: ${error.response.status} - ${error.response.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Handle Google Geocoding API error statuses
   * @param {string} status - Google API status code
   * @param {string} errorMessage - Optional error message
   * @returns {string} Human-readable error message
   */
  handleGoogleError(status, errorMessage) {
    const errorMap = {
      ZERO_RESULTS: "Location not found in Google database",
      OVER_QUERY_LIMIT: "Google Geocoding API quota exceeded",
      REQUEST_DENIED: "Google Geocoding API access denied - check API key",
      INVALID_REQUEST: "Invalid geocoding request format",
      UNKNOWN_ERROR: "Google Geocoding API server error",
    };

    const message = errorMap[status] || `Google API error: ${status}`;
    return errorMessage ? `${message} - ${errorMessage}` : message;
  }

  /**
   * Parse Google's address_components into a structured format
   * @param {Array} components - Google address components
   * @returns {Object} Structured address data
   */
  parseGoogleAddressComponents(components) {
    const address = {};

    components.forEach((component) => {
      const types = component.types;

      if (types.includes("country")) {
        address.country = component.long_name;
        address.countryCode = component.short_name;
      }
      if (types.includes("administrative_area_level_1")) {
        address.state = component.long_name;
      }
      if (types.includes("locality")) {
        address.city = component.long_name;
      }
      if (types.includes("postal_code")) {
        address.postalCode = component.long_name;
      }
      if (types.includes("route")) {
        address.street = component.long_name;
      }
      if (types.includes("street_number")) {
        address.streetNumber = component.long_name;
      }
    });

    return address;
  }

  /**
   * Calculate importance score from Google place types
   * @param {Array} types - Google place types
   * @returns {number} Importance score (0-1)
   */
  calculateImportanceFromTypes(types) {
    const importanceMap = {
      country: 1.0,
      administrative_area_level_1: 0.9,
      locality: 0.8,
      tourist_attraction: 0.7,
      point_of_interest: 0.6,
      establishment: 0.5,
      route: 0.4,
    };

    let maxImportance = 0.3; // Default minimum
    types.forEach((type) => {
      if (importanceMap[type] && importanceMap[type] > maxImportance) {
        maxImportance = importanceMap[type];
      }
    });

    return maxImportance;
  }

  /**
   * Generate realistic route coordinates between multiple points
   * @param {Array} waypoints - Array of location strings
   * @param {string} tripType - 'cycling' or 'trekking'
   * @returns {Array} Array of [lat, lng] coordinates
   */
  async generateRouteCoordinates(waypoints, tripType = "cycling") {
    try {
      console.log("🗺️ Generating route coordinates for waypoints:", waypoints);

      // Geocode all waypoints to get their coordinates
      const geocodedPoints = [];
      for (const waypoint of waypoints) {
        try {
          const locationData = await this.geocodeLocation(waypoint);
          geocodedPoints.push({
            name: waypoint,
            coordinates: locationData.coordinates,
            geocodingMethod: locationData.geocodingMethod,
            displayName: locationData.displayName,
            accuracy: locationData.accuracy,
          });
        } catch (error) {
          console.warn(
            `⚠️ Failed to geocode waypoint "${waypoint}": ${error.message}`
          );
          // Skip this waypoint if geocoding fails
        }
      }

      if (geocodedPoints.length === 0) {
        throw new Error("No waypoints could be geocoded");
      }

      console.log(
        `✅ Successfully geocoded ${geocodedPoints.length}/${waypoints.length} waypoints`
      );

      // Generate route coordinates based on trip type
      if (tripType === "cycling") {
        return this.generateCyclingRoute(geocodedPoints);
      } else {
        return this.generateTrekkingRoute(geocodedPoints);
      }
    } catch (error) {
      console.error("Route coordinate generation error:", error);
      throw error;
    }
  }

  /**
   * Generate cycling route coordinates (city-to-city, road-following)
   * @param {Array} geocodedPoints - Array of geocoded waypoints
   * @returns {Array} Route coordinates
   */
  generateCyclingRoute(geocodedPoints) {
    const allCoordinates = [];

    for (let i = 0; i < geocodedPoints.length - 1; i++) {
      const start = geocodedPoints[i].coordinates;
      const end = geocodedPoints[i + 1].coordinates;

      // Generate intermediate points that simulate following roads
      const segmentCoords = this.generateRoadLikeSegment(
        start,
        end,
        15,
        "cycling"
      );

      // Avoid duplicate coordinates when connecting segments
      if (i === 0) {
        allCoordinates.push(...segmentCoords);
      } else {
        allCoordinates.push(...segmentCoords.slice(1));
      }
    }

    console.log(
      `🚴 Generated cycling route with ${allCoordinates.length} coordinates`
    );
    return allCoordinates;
  }

  /**
   * Generate trekking route coordinates (circular, trail-following)
   * @param {Array} geocodedPoints - Array of geocoded waypoints
   * @returns {Array} Route coordinates
   */
  generateTrekkingRoute(geocodedPoints) {
    if (geocodedPoints.length === 0) {
      throw new Error("No waypoints available for trekking route");
    }

    // For trekking, create a circular route starting and ending at the first point
    const startPoint = geocodedPoints[0].coordinates;
    const allCoordinates = [startPoint];

    // If we have multiple waypoints, visit them and return to start
    if (geocodedPoints.length > 1) {
      for (let i = 1; i < geocodedPoints.length; i++) {
        const target = geocodedPoints[i].coordinates;
        const segmentCoords = this.generateTrailLikeSegment(
          allCoordinates[allCoordinates.length - 1],
          target,
          8,
          "trekking"
        );
        allCoordinates.push(...segmentCoords.slice(1));
      }

      // Return to start point to complete the circle
      const returnCoords = this.generateTrailLikeSegment(
        allCoordinates[allCoordinates.length - 1],
        startPoint,
        8,
        "trekking"
      );
      allCoordinates.push(...returnCoords.slice(1));
    } else {
      // Single point - create a circular route around it
      const circularCoords = this.generateCircularRoute(startPoint, 3, 12);
      allCoordinates.push(...circularCoords);
    }

    console.log(
      `🥾 Generated trekking route with ${allCoordinates.length} coordinates`
    );
    return allCoordinates;
  }

  /**
   * Generate road-like segment between two points (for cycling)
   * @param {Array} start - [lat, lng] start coordinates
   * @param {Array} end - [lat, lng] end coordinates
   * @param {number} numPoints - Number of intermediate points
   * @param {string} routeType - Route type for variation
   * @returns {Array} Array of coordinates
   */
  generateRoadLikeSegment(start, end, numPoints = 15, routeType = "cycling") {
    const coordinates = [start];

    // Calculate the direct distance and bearing
    const latDiff = end[0] - start[0];
    const lngDiff = end[1] - start[1];

    // Add realistic road-following variations
    for (let i = 1; i < numPoints; i++) {
      const progress = i / numPoints;

      // Base interpolation
      let lat = start[0] + latDiff * progress;
      let lng = start[1] + lngDiff * progress;

      // Add road-following variations (simulate following actual roads)
      const roadVariation = this.calculateRoadVariation(
        start,
        end,
        progress,
        routeType
      );
      lat += roadVariation.latOffset;
      lng += roadVariation.lngOffset;

      coordinates.push([lat, lng]);
    }

    coordinates.push(end);
    return coordinates;
  }

  /**
   * Generate trail-like segment between two points (for trekking)
   * @param {Array} start - [lat, lng] start coordinates
   * @param {Array} end - [lat, lng] end coordinates
   * @param {number} numPoints - Number of intermediate points
   * @param {string} routeType - Route type for variation
   * @returns {Array} Array of coordinates
   */
  generateTrailLikeSegment(start, end, numPoints = 8, routeType = "trekking") {
    const coordinates = [start];

    const latDiff = end[0] - start[0];
    const lngDiff = end[1] - start[1];

    // Add realistic trail-following variations
    for (let i = 1; i < numPoints; i++) {
      const progress = i / numPoints;

      // Base interpolation
      let lat = start[0] + latDiff * progress;
      let lng = start[1] + lngDiff * progress;

      // Add trail-following variations (more winding than roads)
      const trailVariation = this.calculateTrailVariation(
        start,
        end,
        progress,
        routeType
      );
      lat += trailVariation.latOffset;
      lng += trailVariation.lngOffset;

      coordinates.push([lat, lng]);
    }

    coordinates.push(end);
    return coordinates;
  }

  /**
   * Generate circular route around a point (for single-point trekking)
   * @param {Array} center - [lat, lng] center coordinates
   * @param {number} radiusKm - Radius in kilometers
   * @param {number} numPoints - Number of points in circle
   * @returns {Array} Array of coordinates forming a circle
   */
  generateCircularRoute(center, radiusKm = 3, numPoints = 12) {
    const coordinates = [center];

    // Convert radius from km to degrees (approximate)
    const radiusLat = radiusKm / 111.0; // 1 degree ≈ 111 km
    const radiusLng =
      radiusKm / (111.0 * Math.cos((center[0] * Math.PI) / 180));

    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;

      const lat = center[0] + radiusLat * Math.sin(angle);
      const lng = center[1] + radiusLng * Math.cos(angle);

      coordinates.push([lat, lng]);
    }

    // Close the circle by returning to start
    coordinates.push(center);
    return coordinates;
  }

  /**
   * Calculate road-following variations for realistic cycling routes
   * @param {Array} start - Start coordinates
   * @param {Array} end - End coordinates
   * @param {number} progress - Progress along route (0-1)
   * @param {string} routeType - Route type
   * @returns {Object} Coordinate offsets
   */
  calculateRoadVariation(start, end, progress, routeType) {
    // Road networks tend to follow certain patterns
    const distance = this.calculateDistance(start, end);

    // Scale variations based on distance (longer routes have more deviation)
    const maxVariation = Math.min(distance * 0.1, 0.02); // Max 2% deviation or 0.02 degrees

    // Create road-like curves using sine waves
    const curveFactor = Math.sin(progress * Math.PI * 3) * 0.3; // Multiple curves
    const directionFactor = Math.sin(progress * Math.PI * 2) * 0.7; // General direction bias

    // Perpendicular offset (simulates roads going around obstacles)
    const bearing = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const perpBearing = bearing + Math.PI / 2;

    const latOffset =
      maxVariation *
      (curveFactor + directionFactor * 0.5) *
      Math.sin(perpBearing);
    const lngOffset =
      maxVariation *
      (curveFactor + directionFactor * 0.5) *
      Math.cos(perpBearing);

    return { latOffset, lngOffset };
  }

  /**
   * Calculate trail-following variations for realistic trekking routes
   * @param {Array} start - Start coordinates
   * @param {Array} end - End coordinates
   * @param {number} progress - Progress along route (0-1)
   * @param {string} routeType - Route type
   * @returns {Object} Coordinate offsets
   */
  calculateTrailVariation(start, end, progress, routeType) {
    // Trails tend to wind more than roads and follow terrain
    const distance = this.calculateDistance(start, end);

    // More variation than roads
    const maxVariation = Math.min(distance * 0.15, 0.03);

    // More winding pattern for trails
    const windingFactor = Math.sin(progress * Math.PI * 5) * 0.4; // More frequent turns
    const terrainFactor = Math.sin(progress * Math.PI * 1.5) * 0.6; // Terrain following
    const randomFactor = (Math.random() - 0.5) * 0.2; // Some randomness

    const bearing = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const perpBearing = bearing + Math.PI / 2;

    const totalFactor = windingFactor + terrainFactor + randomFactor;

    const latOffset = maxVariation * totalFactor * Math.sin(perpBearing);
    const lngOffset = maxVariation * totalFactor * Math.cos(perpBearing);

    return { latOffset, lngOffset };
  }

  /**
   * Calculate approximate distance between two coordinates in kilometers
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
   * Reverse geocode coordinates to get location name
   * @param {Array} coordinates - [lat, lng]
   * @returns {Object} Location information
   */
  async reverseGeocode(coordinates) {
    try {
      const [lat, lng] = coordinates;

      // Try Google reverse geocoding first
      if (this.googleApiKey) {
        try {
          const response = await axios.get(this.googleBaseUrl, {
            params: {
              latlng: `${lat},${lng}`,
              key: this.googleApiKey,
              language: "en",
            },
            timeout: 8000,
          });

          this.googleRequestCount++;

          if (
            response.data.status === "OK" &&
            response.data.results.length > 0
          ) {
            const result = response.data.results[0];
            return {
              displayName: result.formatted_address,
              address: this.parseGoogleAddressComponents(
                result.address_components
              ),
              type: result.types[0] || "unknown",
              source: "Google Geocoding API",
            };
          }
        } catch (error) {
          console.warn("Google reverse geocoding failed:", error.message);
        }
      }

      // Fallback to Nominatim
      const response = await axios.get(`${this.nominatimBaseUrl}/reverse`, {
        params: {
          lat: lat,
          lon: lng,
          format: "json",
          addressdetails: 1,
        },
        headers: this.nominatimHeaders,
        timeout: 8000,
      });

      this.nominatimRequestCount++;

      if (!response.data) {
        throw new Error("No location found for coordinates");
      }

      return {
        displayName: response.data.display_name,
        address: response.data.address || {},
        type: response.data.type,
        source: "Nominatim (OpenStreetMap)",
      };
    } catch (error) {
      console.error("Reverse geocoding error:", error.message);
      throw new Error(`Failed to reverse geocode: ${error.message}`);
    }
  }

  /**
   * Clear geocoding cache (useful for testing or memory management)
   */
  clearCache() {
    this.geocodeCache.clear();
    console.log("🗑️ Geocoding cache cleared");
  }

  /**
   * Get comprehensive service statistics
   * @returns {Object} Service usage and performance information
   */
  getServiceStats() {
    return {
      cacheStats: {
        size: this.geocodeCache.size,
        hits: this.cacheHits,
        keys: Array.from(this.geocodeCache.keys()),
      },
      apiUsage: {
        google: {
          requests: this.googleRequestCount,
          available: !!this.googleApiKey,
          primary: true,
        },
        nominatim: {
          requests: this.nominatimRequestCount,
          available: true,
          fallback: true,
        },
      },
      performance: {
        totalRequests: this.googleRequestCount + this.nominatimRequestCount,
        cacheHitRate:
          this.cacheHits /
          Math.max(
            1,
            this.googleRequestCount +
              this.nominatimRequestCount +
              this.cacheHits
          ),
        fallbackRate:
          this.nominatimRequestCount /
          Math.max(1, this.googleRequestCount + this.nominatimRequestCount),
      },
    };
  }

  /**
   * Check if geocoding services are available and properly configured
   * @returns {Object} Service availability status
   */
  getServiceHealth() {
    return {
      google: {
        available: !!this.googleApiKey,
        configured: !!this.googleApiKey,
        status: this.googleApiKey ? "ready" : "api_key_missing",
      },
      nominatim: {
        available: true,
        configured: true,
        status: "ready",
      },
      fallbackChain: [
        this.googleApiKey ? "Google Geocoding API" : null,
        "Nominatim (OpenStreetMap)",
        "Mock coordinates",
      ].filter(Boolean),
    };
  }
}

module.exports = new GeocodingService();
