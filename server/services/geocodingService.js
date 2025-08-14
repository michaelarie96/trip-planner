const axios = require("axios");

class GeocodingService {
  constructor() {
    // OpenStreetMap Nominatim API - free, no API key required
    this.nominatimBaseUrl = "https://nominatim.openstreetmap.org";

    // Request headers to identify our application (required by Nominatim)
    this.headers = {
      "User-Agent": "TripPlanner-App/1.0 (contact@example.com)",
      Accept: "application/json",
    };

    // Cache for geocoding results to avoid repeated API calls
    this.geocodeCache = new Map();
  }

  /**
   * Geocode a location (city, country) to get coordinates
   * @param {string} location - Location string like "Paris, France" or "France"
   * @returns {Object} Coordinates and location info
   */
  async geocodeLocation(location) {
    try {
      // Check cache first
      const cacheKey = location.toLowerCase().trim();
      if (this.geocodeCache.has(cacheKey)) {
        console.log(`Using cached geocode for: ${location}`);
        return this.geocodeCache.get(cacheKey);
      }

      console.log(`Geocoding location: ${location}`);

      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: location,
          format: "json",
          limit: 1,
          addressdetails: 1,
          extratags: 1,
        },
        headers: this.headers,
        timeout: 10000,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error(`Location "${location}" not found`);
      }

      const result = response.data[0];
      const coordinates = [parseFloat(result.lat), parseFloat(result.lon)];

      const locationData = {
        coordinates,
        displayName: result.display_name,
        address: result.address || {},
        boundingBox: result.boundingbox ? result.boundingbox.map(Number) : null,
        type: result.type,
        importance: result.importance,
      };

      // Cache the result
      this.geocodeCache.set(cacheKey, locationData);

      console.log(`Geocoded "${location}" to:`, coordinates);
      return locationData;
    } catch (error) {
      console.error(`Geocoding error for "${location}":`, error.message);
      throw new Error(`Failed to geocode location: ${error.message}`);
    }
  }

  /**
   * Generate realistic route coordinates between multiple points
   * @param {Array} waypoints - Array of location strings
   * @param {string} tripType - 'cycling' or 'trekking'
   * @returns {Array} Array of [lat, lng] coordinates
   */
  async generateRouteCoordinates(waypoints, tripType = "cycling") {
    try {
      console.log("Generating route coordinates for waypoints:", waypoints);

      // Geocode all waypoints to get their coordinates
      const geocodedPoints = [];
      for (const waypoint of waypoints) {
        try {
          const locationData = await this.geocodeLocation(waypoint);
          geocodedPoints.push({
            name: waypoint,
            coordinates: locationData.coordinates,
            displayName: locationData.displayName,
          });
        } catch (error) {
          console.warn(
            `Failed to geocode waypoint "${waypoint}":`,
            error.message
          );
          // Skip this waypoint if geocoding fails
        }
      }

      if (geocodedPoints.length === 0) {
        throw new Error("No waypoints could be geocoded");
      }

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
      `Generated cycling route with ${allCoordinates.length} coordinates`
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
      `Generated trekking route with ${allCoordinates.length} coordinates`
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

      const response = await axios.get(`${this.nominatimBaseUrl}/reverse`, {
        params: {
          lat: lat,
          lon: lng,
          format: "json",
          addressdetails: 1,
        },
        headers: this.headers,
        timeout: 8000,
      });

      if (!response.data) {
        throw new Error("No location found for coordinates");
      }

      return {
        displayName: response.data.display_name,
        address: response.data.address || {},
        type: response.data.type,
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
    console.log("Geocoding cache cleared");
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache information
   */
  getCacheStats() {
    return {
      size: this.geocodeCache.size,
      keys: Array.from(this.geocodeCache.keys()),
    };
  }
}

module.exports = new GeocodingService();
