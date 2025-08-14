const { GoogleGenAI } = require("@google/genai");
const imageService = require("./imageService");
const geocodingService = require("./geocodingService");
const routingService = require("./routingService");

class LLMService {
  constructor() {
    // Initialize Google Gemini client
    this.genAI = new GoogleGenAI({});
    
    // Configure primary model (Gemini 2.5 Pro for better geographic knowledge)
    this.primaryModel = "gemini-2.5-pro";
    this.fallbackModel = "gemini-1.5-pro-002";

    // Initialize model instances
    this.model = null;
    this.fallbackModelInstance = null;

    this.initializeModels();

    console.log("LLM Service initialized with Google Gemini models:", [
      this.primaryModel,
      this.fallbackModel,
    ]);
  }

  /**
   * Initialize Gemini model instances
   */
  initializeModels() {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not found in environment variables");
      }

      // Primary model configuration for geographic accuracy
      this.model = this.genAI.getGenerativeModel({
        model: this.primaryModel,
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent geographic responses
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
      });

      // Fallback model
      this.fallbackModelInstance = this.genAI.getGenerativeModel({
        model: this.fallbackModel,
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 2048,
        },
      });

      console.log("✓ Gemini models initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Gemini models:", error.message);
      throw error;
    }
  }

  /**
   * Generate a trip route using Gemini with enhanced geographic prompting
   * @param {string} country - Country/region for the trip
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {string} city - Optional city specification
   * @returns {Object} Generated route data with real coordinates
   */
  async generateRoute(country, tripType, city = null) {
    const startTime = Date.now();

    try {
      console.log(
        `🚀 Generating ${tripType} route for ${city || country} using Gemini`
      );

      // Build enhanced geographic prompt
      const prompt = this.buildEnhancedGeographicPrompt(
        country,
        tripType,
        city
      );
      console.log("Generated enhanced geographic prompt for Gemini");

      // Try primary model first, then fallback
      let geminiResult = null;
      let modelUsed = null;

      try {
        console.log(`Attempting route generation with ${this.primaryModel}`);
        geminiResult = await this.callGeminiWithRetry(this.model, prompt);
        modelUsed = this.primaryModel;
        console.log("✓ Primary Gemini model succeeded");
      } catch (primaryError) {
        console.warn(`Primary model failed: ${primaryError.message}`);
        console.log(`Falling back to ${this.fallbackModel}`);

        try {
          geminiResult = await this.callGeminiWithRetry(
            this.fallbackModelInstance,
            prompt
          );
          modelUsed = this.fallbackModel;
          console.log("✓ Fallback Gemini model succeeded");
        } catch (fallbackError) {
          throw new Error(
            `Both Gemini models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
          );
        }
      }

      // Process the Gemini response with real routing
      const processedRoute = await this.processGeminiResponseWithRealRouting(
        geminiResult,
        tripType,
        country,
        city
      );

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Route generated successfully with ${modelUsed} in ${processingTime}ms`
      );

      // Try to get a representative image for the country
      let imageData = null;
      try {
        console.log("🖼️ Fetching country image...");
        imageData = await imageService.getImage(country, city);
        console.log("✓ Country image retrieved successfully");
      } catch (imageError) {
        console.warn("⚠️ Failed to get country image:", imageError.message);
        // Don't fail route generation if image fails
      }

      return {
        ...processedRoute,
        imageUrl: imageData?.imageUrl || null,
        imageData: imageData || null,
        generationMetadata: {
          llmModel: modelUsed,
          llmProvider: "Google Gemini",
          prompt: prompt,
          processingTime: processingTime,
          generatedAt: new Date(),
          imageRetrieved: !!imageData,
          routingMethod: processedRoute.routingMetadata?.method || "fallback",
          temperature: modelUsed === this.primaryModel ? 0.3 : 0.4,
        },
      };
    } catch (error) {
      console.error("❌ Gemini Route Generation Error:", error);
      throw new Error(`Failed to generate route with Gemini: ${error.message}`);
    }
  }

  /**
   * Build enhanced geographic prompt specifically designed for Gemini's strengths
   * @param {string} country - Country name
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {string} city - Optional city
   * @returns {string} Enhanced prompt for better geographic accuracy
   */
  buildEnhancedGeographicPrompt(country, tripType, city) {
    const location = city ? `${city}, ${country}` : country;

    // Base geographic context to help Gemini understand the requirements
    const geographicContext = `You are a local travel expert with extensive knowledge of ${country}. 
You must create a realistic route using actual places, real distances, and practical travel times.
CRITICAL: Verify all distances are realistic and achievable for the specified activity.`;

    if (tripType === "cycling") {
      return `${geographicContext}

Create a realistic 2-day cycling route in ${location} following these STRICT requirements:

DISTANCE CONSTRAINTS (MUST FOLLOW):
- Day 1: Maximum 60km cycling distance
- Day 2: Maximum 60km cycling distance
- Total route: Maximum 120km over 2 days
- Use actual road distances, not straight-line distances

ROUTE REQUIREMENTS:
- Start and end in different cities/towns (city-to-city route)
- Day 2 starts where Day 1 ends
- Follow actual roads suitable for cycling
- Include real cities, towns, and landmarks that exist
- Verify distances between locations are realistic for cycling

LOCATION SPECIFICITY:
- Use actual city names, not generic descriptions
- Include real landmarks, villages, or cycling-popular areas
- Consider local geography and terrain
- Mention actual roads or cycling routes if known

Return ONLY valid JSON in this exact format:
{
  "route": {
    "day1": {
      "start": "Actual Starting City Name",
      "end": "Actual Ending City Name",
      "distance": 45,
      "waypoints": ["Real Town/Landmark 1", "Real Town/Landmark 2"]
    },
    "day2": {
      "start": "Same as Day 1 end",
      "end": "Final Real Destination",
      "distance": 50,
      "waypoints": ["Real Town/Landmark 3", "Real Town/Landmark 4"]
    },
    "totalDistance": 95,
    "estimatedDuration": "2 days",
    "difficulty": "moderate"
  }
}

Remember: Each day must be under 60km. Verify your distances are realistic for the actual locations.`;
    } else {
      return `${geographicContext}

Create a realistic circular trekking route in ${location} following these STRICT requirements:

DISTANCE CONSTRAINTS (MUST FOLLOW):
- Total distance: Between 5-15km only
- Circular route (start and end at same location)
- Walking/hiking pace, not cycling
- Achievable in one day (4-8 hours maximum)

ROUTE REQUIREMENTS:
- Start and end at the exact same point (circular route)
- Follow actual hiking trails, walking paths, or nature routes
- Include real landmarks, viewpoints, or natural features
- Use realistic hiking distances and times

LOCATION SPECIFICITY:
- Name actual trailheads, parks, or hiking areas
- Include real natural landmarks (lakes, hills, forests)
- Consider local terrain and elevation
- Mention actual trail names or hiking routes if known

Return ONLY valid JSON in this exact format:
{
  "route": {
    "day1": {
      "start": "Real Trailhead/Starting Point Name",
      "end": "Same Trailhead/Starting Point Name",
      "distance": 8,
      "waypoints": ["Real Landmark 1", "Real Viewpoint/Summit", "Real Natural Feature", "Real Trail Junction"]
    },
    "totalDistance": 8,
    "estimatedDuration": "1 day",
    "difficulty": "moderate"
  }
}

Remember: Distance must be 5-15km total. Route must be circular (same start/end). Verify locations exist.`;
    }
  }

  /**
   * Call Gemini API with retry logic
   * @param {Object} modelInstance - Gemini model instance
   * @param {string} prompt - The prompt to send
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {string} Model response text
   */
  async callGeminiWithRetry(modelInstance, prompt, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Gemini API attempt ${attempt}/${maxRetries}`);

        const result = await modelInstance.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text || text.trim().length === 0) {
          throw new Error("Empty response from Gemini API");
        }

        console.log(`✓ Gemini API call successful on attempt ${attempt}`);
        return text;
      } catch (error) {
        console.warn(`⚠️ Gemini attempt ${attempt} failed:`, error.message);
        lastError = error;

        // Handle specific Gemini API errors
        if (error.message.includes("SAFETY")) {
          throw new Error("Content blocked by Gemini safety filters");
        }

        if (error.message.includes("QUOTA_EXCEEDED")) {
          throw new Error("Gemini API quota exceeded");
        }

        if (error.message.includes("API_KEY")) {
          throw new Error("Invalid Gemini API key");
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new Error("All Gemini API attempts failed");
  }

  /**
   * Process Gemini response and generate real routing coordinates
   * Uses the same logic as before but with enhanced error handling for Gemini
   */
  async processGeminiResponseWithRealRouting(
    geminiResponse,
    tripType,
    country,
    city
  ) {
    try {
      console.log("🔄 Processing Gemini response with real routing...");

      // Extract JSON from Gemini response (may have markdown formatting)
      let jsonText = geminiResponse.trim();

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/, "").replace(/```\s*$/, "");

      // Find JSON object in response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Gemini response");
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      if (!parsedResponse.route) {
        throw new Error("Invalid response structure: missing 'route' field");
      }

      const route = parsedResponse.route;

      // Enhanced validation for Gemini responses
      this.validateGeminiRouteData(route, tripType);
      console.log("✓ Gemini route structure validated successfully");

      // Extract waypoints from Gemini response
      const waypointNames = this.extractWaypointsFromRoute(
        route,
        country,
        city
      );
      console.log("📍 Extracted waypoints:", waypointNames);

      // Generate realistic coordinates using geocoding + routing
      const coordinatesResult = await this.generateRealRouteCoordinates(
        waypointNames,
        tripType,
        route
      );

      // Transform to our internal format
      const processedRoute = {
        country: country,
        city: city,
        tripType: tripType,
        routeData: {
          coordinates: coordinatesResult.coordinates,
          waypoints: waypointNames,
          dailyRoutes: this.formatDailyRoutesWithRealData(
            route,
            tripType,
            coordinatesResult
          ),
          totalDistance:
            coordinatesResult.totalDistance ||
            this.calculateTotalDistance(route),
          estimatedDuration:
            coordinatesResult.estimatedDuration ||
            route.estimatedDuration ||
            this.getDefaultDuration(tripType),
          difficulty:
            coordinatesResult.difficulty || route.difficulty || "moderate",
        },
        routingMetadata: coordinatesResult.metadata,
      };

      console.log(
        `✅ Route processed: ${processedRoute.routeData.totalDistance}km with ${processedRoute.routeData.coordinates.length} coordinates`
      );
      return processedRoute;
    } catch (error) {
      console.error("❌ Error processing Gemini response:", error);
      console.error("Raw Gemini response:", geminiResponse);
      throw new Error(`Failed to process Gemini response: ${error.message}`);
    }
  }

  /**
   * Enhanced validation specifically for Gemini responses
   * @param {Object} route - Route data from Gemini
   * @param {string} tripType - Trip type
   */
  validateGeminiRouteData(route, tripType) {
    if (!route.day1) {
      throw new Error("Missing day1 route data in Gemini response");
    }

    // Validate required fields
    if (!route.day1.start || !route.day1.end || !route.day1.distance) {
      throw new Error("Incomplete day1 data in Gemini response");
    }

    if (tripType === "cycling") {
      if (!route.day2) {
        throw new Error("Cycling routes must have day2 data");
      }

      if (!route.day2.start || !route.day2.end || !route.day2.distance) {
        throw new Error("Incomplete day2 data in Gemini response");
      }

      // Strict distance validation for cycling
      if (route.day1.distance > 60) {
        throw new Error(
          `Day 1 distance ${route.day1.distance}km exceeds 60km limit`
        );
      }

      if (route.day2.distance > 60) {
        throw new Error(
          `Day 2 distance ${route.day2.distance}km exceeds 60km limit`
        );
      }

      // Validate connection between days
      if (route.day1.end !== route.day2.start) {
        console.warn("Warning: Day 2 should start where Day 1 ends");
      }
    } else if (tripType === "trekking") {
      // Strict distance validation for trekking
      if (route.day1.distance < 5 || route.day1.distance > 15) {
        throw new Error(
          `Trekking distance ${route.day1.distance}km must be between 5-15km`
        );
      }

      // Validate circular route for trekking
      if (route.day1.start !== route.day1.end) {
        console.warn(
          "Warning: Trekking route should be circular (same start/end point)"
        );
      }
    }

    // Validate that distances are numbers
    if (typeof route.day1.distance !== "number" || route.day1.distance <= 0) {
      throw new Error("Invalid distance format in Gemini response");
    }

    console.log("✓ Gemini route data validation passed");
  }

  /**
   * Generate real route coordinates using geocoding + routing services
   * @param {Array} waypointNames - Array of location names from LLM
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {Object} llmRoute - Original route data from LLM
   * @returns {Object} Coordinates and routing metadata
   */
  async generateRealRouteCoordinates(waypointNames, tripType, llmRoute) {
    let routingMethod = "unknown";
    let routingError = null;

    try {
      console.log("Step 1: Geocoding waypoint names to coordinates...");

      // Step 1: Geocode waypoint names to coordinates
      const geocodedWaypoints = [];
      for (const waypointName of waypointNames) {
        try {
          const locationData = await geocodingService.geocodeLocation(
            waypointName
          );
          geocodedWaypoints.push({
            name: waypointName,
            coordinates: locationData.coordinates,
            geocodingData: locationData,
          });
          console.log(
            `✓ Geocoded: ${waypointName} → ${locationData.coordinates}`
          );
        } catch (error) {
          console.warn(
            `✗ Failed to geocode: ${waypointName} - ${error.message}`
          );
          // Skip waypoints that can't be geocoded
        }
      }

      if (geocodedWaypoints.length < 2) {
        throw new Error(
          `Insufficient geocoded waypoints: ${geocodedWaypoints.length}/2 minimum required`
        );
      }

      console.log(`Step 2: Using routing service for ${tripType} route...`);

      // Step 2: Use routing service to get real road/trail coordinates
      const waypointCoordinates = geocodedWaypoints.map((wp) => wp.coordinates);

      let routingResult;

      if (tripType === "trekking" && waypointCoordinates.length === 1) {
        // For single-point trekking, create circular route
        const distance = llmRoute.day1?.distance || 10; // Default 10km
        routingResult = await routingService.getCircularRoute(
          waypointCoordinates[0],
          distance
        );
        routingMethod = "circular_routing";
      } else {
        // For multi-point routes (cycling or multi-waypoint trekking)
        routingResult = await routingService.getRouteCoordinates(
          waypointCoordinates,
          tripType
        );
        routingMethod = "point_to_point_routing";
      }

      console.log(
        `✓ Routing successful: ${routingResult.coordinates.length} coordinates generated`
      );

      return {
        coordinates: routingResult.coordinates,
        totalDistance: routingResult.distance,
        estimatedDuration: this.formatDuration(
          routingResult.duration,
          tripType
        ),
        difficulty: routingResult.difficulty,
        metadata: {
          method: routingMethod,
          geocodedWaypoints: geocodedWaypoints.length,
          routingSource: routingResult.source,
          routingProfile: routingResult.profile,
          error: null,
        },
      };
    } catch (error) {
      console.error(`Routing failed (${routingMethod}):`, error.message);
      routingError = error.message;

      // Fallback to geocoding-only coordinates
      console.log("Falling back to geocoding-based coordinate generation...");

      try {
        const fallbackCoordinates =
          await geocodingService.generateRouteCoordinates(
            waypointNames,
            tripType
          );
        routingMethod = "geocoding_fallback";
        console.log(
          `✓ Fallback successful: ${fallbackCoordinates.length} coordinates`
        );

        return {
          coordinates: fallbackCoordinates,
          totalDistance: this.calculateTotalDistance(llmRoute),
          estimatedDuration:
            llmRoute.estimatedDuration || this.getDefaultDuration(tripType),
          difficulty: llmRoute.difficulty || "moderate",
          metadata: {
            method: routingMethod,
            geocodedWaypoints: waypointNames.length,
            routingSource: "geocoding_service",
            routingProfile: "fallback",
            error: routingError,
          },
        };
      } catch (fallbackError) {
        console.error("Geocoding fallback also failed:", fallbackError.message);

        // Final fallback to mock coordinates
        console.log("Using final fallback: mock coordinates");
        const mockCoordinates = this.generateMockCoordinates(
          waypointNames[0] || "Unknown",
          null,
          llmRoute
        );

        return {
          coordinates: mockCoordinates,
          totalDistance: this.calculateTotalDistance(llmRoute),
          estimatedDuration:
            llmRoute.estimatedDuration || this.getDefaultDuration(tripType),
          difficulty: llmRoute.difficulty || "moderate",
          metadata: {
            method: "mock_fallback",
            geocodedWaypoints: 0,
            routingSource: "mock_generator",
            routingProfile: "fallback",
            error: `Routing: ${routingError}, Geocoding: ${fallbackError.message}`,
          },
        };
      }
    }
  }

  /**
   * Format duration from minutes to human-readable string
   * @param {number} durationMinutes - Duration in minutes
   * @param {string} tripType - Trip type for context
   * @returns {string} Formatted duration
   */
  formatDuration(durationMinutes, tripType) {
    if (!durationMinutes || durationMinutes <= 0) {
      return tripType === "cycling" ? "2 days" : "1 day";
    }

    const hours = Math.round(durationMinutes / 60);

    if (tripType === "cycling") {
      // For cycling, convert to days
      const days = Math.max(1, Math.round(hours / 8)); // Assume 8 hours cycling per day
      return `${days} day${days > 1 ? "s" : ""}`;
    } else {
      // For trekking, show hours
      if (hours < 1) {
        return `${durationMinutes} minutes`;
      } else if (hours < 8) {
        return `${hours} hour${hours > 1 ? "s" : ""}`;
      } else {
        return "1 day";
      }
    }
  }

  /**
   * Format daily routes with real routing data
   * @param {Object} route - Original LLM route data
   * @param {string} tripType - Trip type
   * @param {Object} coordinatesResult - Real routing result
   * @returns {Array} Formatted daily routes
   */
  formatDailyRoutesWithRealData(route, tripType, coordinatesResult) {
    const dailyRoutes = [];
    const totalCoordinates = coordinatesResult.coordinates;

    // Day 1
    if (route.day1) {
      const day1Coords = this.extractDayCoordinates(
        totalCoordinates,
        1,
        tripType
      );

      dailyRoutes.push({
        day: 1,
        startPoint: route.day1.start,
        endPoint: route.day1.end,
        distance:
          route.day1.distance ||
          Math.round(
            coordinatesResult.totalDistance / (tripType === "cycling" ? 2 : 1)
          ),
        coordinates: day1Coords,
        waypoints: route.day1.waypoints || [],
      });
    }

    // Day 2 (only for cycling)
    if (tripType === "cycling" && route.day2) {
      const day2Coords = this.extractDayCoordinates(
        totalCoordinates,
        2,
        tripType
      );

      dailyRoutes.push({
        day: 2,
        startPoint: route.day2.start,
        endPoint: route.day2.end,
        distance:
          route.day2.distance ||
          Math.round(coordinatesResult.totalDistance / 2),
        coordinates: day2Coords,
        waypoints: route.day2.waypoints || [],
      });
    }

    return dailyRoutes;
  }

  /**
   * Extract coordinates for a specific day from the total route
   * @param {Array} totalCoordinates - All route coordinates
   * @param {number} dayNumber - Day number (1 or 2)
   * @param {string} tripType - Trip type
   * @returns {Array} Coordinates for that day
   */
  extractDayCoordinates(totalCoordinates, dayNumber, tripType) {
    if (tripType === "trekking" || dayNumber === 1) {
      // For trekking or day 1 of cycling, return all coordinates
      return totalCoordinates;
    }

    // For day 2 of cycling, split coordinates roughly in half
    const midPoint = Math.floor(totalCoordinates.length / 2);
    return totalCoordinates.slice(midPoint);
  }

  /**
   * Extract waypoints from route data for geocoding
   * @param {Object} route - Route data from LLM
   * @param {string} country - Country name
   * @param {string} city - City name
   * @returns {Array} Array of waypoint names for geocoding
   */
  extractWaypointsFromRoute(route, country, city) {
    const waypoints = [];

    try {
      if (route.day1) {
        if (route.day1.start) {
          waypoints.push(
            this.formatLocationForGeocoding(route.day1.start, country)
          );
        }

        if (route.day1.waypoints && route.day1.waypoints.length > 0) {
          route.day1.waypoints.forEach((waypoint) => {
            waypoints.push(this.formatLocationForGeocoding(waypoint, country));
          });
        }

        if (route.day1.end && route.day1.end !== route.day1.start) {
          waypoints.push(
            this.formatLocationForGeocoding(route.day1.end, country)
          );
        }
      }

      if (route.day2) {
        if (route.day2.waypoints && route.day2.waypoints.length > 0) {
          route.day2.waypoints.forEach((waypoint) => {
            waypoints.push(this.formatLocationForGeocoding(waypoint, country));
          });
        }

        if (route.day2.end) {
          waypoints.push(
            this.formatLocationForGeocoding(route.day2.end, country)
          );
        }
      }

      // Remove duplicates
      const uniqueWaypoints = [];
      const seen = new Set();

      waypoints.forEach((waypoint) => {
        const normalized = waypoint.toLowerCase().trim();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          uniqueWaypoints.push(waypoint);
        }
      });

      console.log(
        `Extracted ${uniqueWaypoints.length} unique waypoints from ${waypoints.length} total`
      );
      return uniqueWaypoints;
    } catch (error) {
      console.error("Error extracting waypoints:", error);
      return [];
    }
  }

  /**
   * Format location for geocoding API
   * @param {string} location - Raw location name
   * @param {string} country - Country name
   * @returns {string} Formatted location string
   */
  formatLocationForGeocoding(location, country) {
    if (!location) return "";

    const cleanLocation = location.trim();

    if (cleanLocation.toLowerCase().includes(country.toLowerCase())) {
      return cleanLocation;
    }

    return `${cleanLocation}, ${country}`;
  }

  /**
   * Calculate total distance from route data
   * @param {Object} route - Route data
   * @returns {number} Total distance in kilometers
   */
  calculateTotalDistance(route) {
    let total = 0;
    if (route.day1 && route.day1.distance) total += route.day1.distance;
    if (route.day2 && route.day2.distance) total += route.day2.distance;
    return total || route.totalDistance || 0;
  }

  /**
   * Get default duration for trip type
   * @param {string} tripType - Trip type
   * @returns {string} Default duration string
   */
  getDefaultDuration(tripType) {
    return tripType === "cycling" ? "2 days" : "1 day";
  }

  /**
   * Generate mock coordinates as final fallback
   * @param {string} country - Country name
   * @param {string} city - City name
   * @param {Object} route - Route data
   * @returns {Array} Array of mock coordinates
   */
  generateMockCoordinates(country, city, route) {
    console.log("Using fallback mock coordinates");

    const baseCoords = this.getCountryBaseCoordinates(country);
    const coordinates = [];
    const numPoints = 15;

    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);

      const latOffset =
        Math.sin(progress * Math.PI * 2) * 0.05 + (Math.random() - 0.5) * 0.02;
      const lngOffset =
        Math.cos(progress * Math.PI * 1.5) * 0.05 +
        (Math.random() - 0.5) * 0.02;

      coordinates.push([baseCoords[0] + latOffset, baseCoords[1] + lngOffset]);
    }

    console.log(`Generated ${coordinates.length} mock coordinates as fallback`);
    return coordinates;
  }

  /**
   * Get base coordinates for countries
   * @param {string} country - Country name
   * @returns {Array} [lat, lng] coordinates
   */
  getCountryBaseCoordinates(country) {
    const countryCoords = {
      france: [46.2276, 2.2137],
      spain: [40.4637, -3.7492],
      italy: [41.8719, 12.5674],
      germany: [51.1657, 10.4515],
      "united kingdom": [55.3781, -3.436],
      uk: [55.3781, -3.436],
      britain: [55.3781, -3.436],
      switzerland: [46.8182, 8.2275],
      austria: [47.5162, 14.5501],
      portugal: [39.3999, -8.2245],
      netherlands: [52.1326, 5.2913],
      belgium: [50.5039, 4.4699],
      norway: [60.472, 8.4689],
      sweden: [60.1282, 18.6435],
      denmark: [56.2639, 9.5018],
      "united states": [39.8283, -98.5795],
      usa: [39.8283, -98.5795],
      canada: [56.1304, -106.3468],
      mexico: [23.6345, -102.5528],
      japan: [36.2048, 138.2529],
      australia: [-25.2744, 133.7751],
      "new zealand": [-40.9006, 174.886],
      chile: [-35.6751, -71.543],
      argentina: [-38.4161, -63.6167],
      brazil: [-14.235, -51.9253],
      peru: [-9.19, -75.0152],
      colombia: [4.5709, -74.2973],
    };

    const normalized = country.toLowerCase().trim();
    const coords = countryCoords[normalized];

    if (coords) {
      console.log(`Found coordinates for ${country}:`, coords);
      return coords;
    }

    console.warn(`No coordinates found for "${country}", using default`);
    return [50.0, 10.0];
  }

  /**
   * Get API usage and model information
   * @returns {Object} Service status information
   */
  getServiceStatus() {
    return {
      provider: "Google Gemini",
      primaryModel: this.primaryModel,
      fallbackModel: this.fallbackModel,
      hasApiKey: !!process.env.GEMINI_API_KEY,
      modelsInitialized: !!(this.model && this.fallbackModelInstance),
      temperature: {
        primary: 0.3,
        fallback: 0.4,
      },
      features: [
        "Enhanced geographic knowledge",
        "Realistic distance validation",
        "Real road/trail routing integration",
        "Dual model fallback system",
      ],
    };
  }
}

module.exports = new LLMService();
