const { GoogleGenAI } = require("@google/genai");
const imageService = require("./imageService");
const geocodingService = require("./geocodingService");
const routingService = require("./routingService");

class LLMService {
  constructor() {
    // Initialize Google GenAI client with new SDK
    this.genAI = null;

    // Configure primary and fallback models
    this.primaryModel = "gemini-2.5-pro";
    this.fallbackModel = "gemini-2.5-flash";

    this.initializeGenAI();

    console.log("LLM Service initialized with new Google GenAI SDK:", [
      this.primaryModel,
      this.fallbackModel,
    ]);
  }

  /**
   * Initialize Google GenAI client with new SDK
   */
  initializeGenAI() {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not found in environment variables");
      }

      // Initialize the new GoogleGenAI client - it automatically picks up GEMINI_API_KEY from env
      this.genAI = new GoogleGenAI({});

      console.log(
        "✓ Google GenAI client initialized successfully with new SDK"
      );
    } catch (error) {
      console.error("Failed to initialize Google GenAI client:", error.message);
      throw error;
    }
  }

  /**
   * Generate a trip route using new Google GenAI SDK
   * @param {string} country - Country/region for the trip
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {string} city - Optional city specification
   * @returns {Object} Generated route data with real coordinates
   */
  async generateRoute(country, tripType, city = null) {
    const startTime = Date.now();

    try {
      console.log(
        `🚀 Generating ${tripType} route for ${
          city || country
        } using new GenAI SDK`
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
        geminiResult = await this.callGenAIWithRetry(this.primaryModel, prompt);
        modelUsed = this.primaryModel;
        console.log("✓ Primary Gemini model succeeded");
      } catch (primaryError) {
        console.warn(`Primary model failed: ${primaryError.message}`);
        console.log(`Falling back to ${this.fallbackModel}`);

        try {
          geminiResult = await this.callGenAIWithRetry(
            this.fallbackModel,
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
          llmProvider: "Google Gemini (New SDK)",
          prompt: prompt,
          processingTime: processingTime,
          generatedAt: new Date(),
          imageRetrieved: !!imageData,
          routingMethod: processedRoute.routingMetadata?.method || "fallback",
          sdkVersion: "new_genai_2024",
        },
      };
    } catch (error) {
      console.error("❌ Gemini Route Generation Error:", error);
      throw new Error(`Failed to generate route with Gemini: ${error.message}`);
    }
  }

  /**
   * Call new Google GenAI API with retry logic
   * @param {string} modelName - Model name to use
   * @param {string} prompt - The prompt to send
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {string} Model response text
   */
  async callGenAIWithRetry(modelName, prompt, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📤 GenAI API attempt ${attempt}/${maxRetries} with ${modelName}`
        );

        // Build config based on model capabilities
        const config = {
          temperature: modelName === this.primaryModel ? 0.3 : 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
        };

        // Configure thinking for 2.5 series models (they require thinking mode)
        if (modelName.includes("2.5")) {
          // Use moderate thinking budget for structured geographic responses
          config.thinkingConfig = {
            thinkingBudget: -1, // Dynamic thinking - let model decide
          };
          console.log(
            `🧠 Using DYNAMIC thinking mode for ${modelName} (workaround for API bug)`
          );
        } else {
          // For non-2.5 models, don't include thinking config
          console.log(`🚀 Using standard mode for ${modelName}`);
        }

        // Use new SDK API structure
        const response = await this.genAI.models.generateContent({
          model: modelName,
          contents: prompt,
          config: config,
        });

        const text = response.text;

        if (!text || text.trim().length === 0) {
          throw new Error("Empty response from Gemini API");
        }

        console.log(`✓ GenAI API call successful on attempt ${attempt}`);
        console.log(`Response preview: ${text.substring(0, 200)}...`);
        return text;
      } catch (error) {
        console.warn(`⚠️ GenAI attempt ${attempt} failed:`, error.message);
        lastError = error;

        // Handle specific GenAI API errors
        if (error.message && error.message.includes("SAFETY")) {
          throw new Error("Content blocked by Gemini safety filters");
        }

        if (error.message && error.message.includes("QUOTA_EXCEEDED")) {
          throw new Error("Gemini API quota exceeded");
        }

        if (error.message && error.message.includes("API_KEY")) {
          throw new Error("Invalid Gemini API key");
        }

        if (error.message && error.message.includes("INVALID_ARGUMENT")) {
          throw new Error(
            `Invalid request format sent to Gemini API: ${error.message}`
          );
        }

        if (error.message && error.message.includes("Budget")) {
          throw new Error(
            `Thinking budget error for ${modelName}: ${error.message}`
          );
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new Error("All GenAI API attempts failed");
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

CRITICAL CONSTRAINTS (MUST FOLLOW):
- Total distance: Between 5-15km ONLY (be very strict about this)
- CIRCULAR route: MUST start and end at EXACTLY the same location
- Walking/hiking pace, not cycling
- Achievable in one day (3-6 hours maximum)

ROUTE REQUIREMENTS:
- Start point name MUST EXACTLY MATCH end point name
- Follow actual hiking trails, walking paths, or nature routes
- CRITICAL: Create a TRUE LOOP where you visit different places and return via a DIFFERENT path
- Include 4-5 real landmarks/waypoints that form a CIRCULAR path, not a line
- Waypoints should be arranged in a rough circle/square/triangle around the starting point
- AVOID linear arrangements (A→B→C then C→B→A) - instead aim for A→B→C→D→A
- Each waypoint should be roughly equidistant from the center, creating a loop shape
- Use realistic hiking distances and times for the terrain

LOCATION SPECIFICITY:
- Name actual trailheads, parks, or well-known hiking areas
- Include real natural landmarks (lakes, hills, forests, viewpoints) 
- CRITICAL: Waypoints must be within WALKING DISTANCE of each other (max 3-5km between each waypoint)
- Choose waypoints that are realistically connected by hiking trails or walking paths
- Avoid waypoints that are in completely different regions or require driving between them

DISTANCE VERIFICATION:
- Double-check that your distance is between 5-15km
- Consider that hiking is slower than road distance
- Account for elevation changes in your distance calculation
- CRITICAL: Ensure waypoints form a logical walking loop, not scattered tourist destinations

Return ONLY valid JSON in this exact format:
{
  "route": {
    "day1": {
      "start": "Exact Same Trailhead Name",
      "end": "Exact Same Trailhead Name", 
      "distance": 8,
      "waypoints": ["Real Landmark 1", "Real Viewpoint", "Real Natural Feature", "Real Trail Junction"]
    },
    "totalDistance": 8,
    "estimatedDuration": "1 day",
    "difficulty": "moderate"
  }
}

REMEMBER: 
1. Distance MUST be 5-15km (verify this twice)
2. Start and end names must be IDENTICAL 
3. Route must be physically possible as a circle
4. All locations must be real places that exist`;
    }
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

      // CRITICAL FIX: Validate waypoint distances for trekking routes
      if (tripType === "trekking") {
        const filteredWaypoints = this.filterWaypointsForTrekking(geocodedWaypoints, llmRoute.day1?.distance || 15);
        
        if (filteredWaypoints.length < 2) {
          console.warn(`⚠️ After distance filtering: only ${filteredWaypoints.length} waypoints remain`);
          // Fall back to circular route from first waypoint
          if (filteredWaypoints.length >= 1) {
            console.log("🔄 Falling back to circular route from first valid waypoint");
            const distance = llmRoute.day1?.distance || 10;
            routingResult = await routingService.getCircularRoute(
              filteredWaypoints[0].coordinates,
              distance
            );
            routingMethod = "filtered_circular_routing";
            
            const llmTotalDistance = this.calculateTotalDistanceFromLLM(llmRoute);
            
            return {
              coordinates: routingResult.coordinates,
              totalDistance: llmTotalDistance,
              estimatedDuration: this.formatDuration(routingResult.duration, tripType),
              difficulty: routingResult.difficulty,
              metadata: {
                method: routingMethod,
                geocodedWaypoints: geocodedWaypoints.length,
                filteredWaypoints: filteredWaypoints.length,
                routingSource: routingResult.source,
                routingProfile: routingResult.profile,
                llmDistance: llmTotalDistance,
                distanceSource: "llm_authoritative",
                error: null,
              },
            };
          }
        } else {
          // Update geocoded waypoints to use filtered ones
          geocodedWaypoints.splice(0, geocodedWaypoints.length, ...filteredWaypoints);
          console.log(`✓ Distance validation passed: using ${filteredWaypoints.length} filtered waypoints`);
        }
      }

      console.log(`Step 2: Using routing service for ${tripType} route...`);

      // Step 2: Use routing service to get real road/trail coordinates
      const waypointCoordinates = geocodedWaypoints.map((wp) => wp.coordinates);

      let routingResult;

      if (tripType === "trekking") {
        if (waypointCoordinates.length === 1) {
          // For single-point trekking, create circular route
          const distance = llmRoute.day1?.distance || 10; // Default 10km
          routingResult = await routingService.getCircularRoute(
            waypointCoordinates[0],
            distance
          );
          routingMethod = "circular_routing";
        } else {
          // For multi-point trekking, optimize waypoint order for a proper loop
          const optimizedWaypoints = this.optimizeWaypointsForLoop(
            waypointCoordinates,
            geocodedWaypoints
          );
          
          // Ensure it's circular by adding start point as end point if not already there
          const startPoint = optimizedWaypoints[0];
          const endPoint = optimizedWaypoints[optimizedWaypoints.length - 1];
          const distanceToStart = this.calculateDistanceBetweenCoords(startPoint, endPoint);
          
          // Only add start point if end point is more than 100m away from start
          if (distanceToStart > 0.1) {
            optimizedWaypoints.push(startPoint);
          }
          
          routingResult = await routingService.getRouteCoordinates(
            optimizedWaypoints,
            tripType
          );
          routingMethod = "circular_trekking_routing";
        }
      } else {
        // For cycling routes (multi-point)
        routingResult = await routingService.getRouteCoordinates(
          waypointCoordinates,
          tripType
        );
        routingMethod = "point_to_point_routing";
      }

      console.log(
        `✓ Routing successful: ${routingResult.coordinates.length} coordinates generated`
      );

      // CRITICAL FIX: Calculate total distance from LLM data, not routing service
      const llmTotalDistance = this.calculateTotalDistanceFromLLM(llmRoute);
      console.log(
        `📏 LLM total distance: ${llmTotalDistance}km (authoritative)`
      );
      console.log(
        `📏 Routing service distance: ${routingResult.distance}km (reference only)`
      );

      return {
        coordinates: routingResult.coordinates,
        // USE LLM DISTANCE AS AUTHORITATIVE SOURCE
        totalDistance: llmTotalDistance,
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
          // Store routing service distance for reference/debugging
          routingServiceDistance: routingResult.distance,
          llmDistance: llmTotalDistance,
          distanceSource: "llm_authoritative",
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

        // Use LLM distance even in fallback
        const llmTotalDistance = this.calculateTotalDistanceFromLLM(llmRoute);

        return {
          coordinates: fallbackCoordinates,
          totalDistance: llmTotalDistance, // LLM distance, not calculated
          estimatedDuration:
            llmRoute.estimatedDuration || this.getDefaultDuration(tripType),
          difficulty: llmRoute.difficulty || "moderate",
          metadata: {
            method: routingMethod,
            geocodedWaypoints: waypointNames.length,
            routingSource: "geocoding_service",
            routingProfile: "fallback",
            llmDistance: llmTotalDistance,
            distanceSource: "llm_authoritative",
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

        // Use LLM distance even in final fallback
        const llmTotalDistance = this.calculateTotalDistanceFromLLM(llmRoute);

        return {
          coordinates: mockCoordinates,
          totalDistance: llmTotalDistance, // LLM distance, not mock
          estimatedDuration:
            llmRoute.estimatedDuration || this.getDefaultDuration(tripType),
          difficulty: llmRoute.difficulty || "moderate",
          metadata: {
            method: "mock_fallback",
            geocodedWaypoints: 0,
            routingSource: "mock_generator",
            routingProfile: "fallback",
            llmDistance: llmTotalDistance,
            distanceSource: "llm_authoritative",
            error: `Routing: ${routingError}, Geocoding: ${fallbackError.message}`,
          },
        };
      }
    }
  }

  /**
   * Calculate total distance from LLM route data
   * This ensures consistency between daily distances and total
   * @param {Object} llmRoute - Original route data from LLM
   * @returns {number} Total distance in kilometers from LLM
   */
  calculateTotalDistanceFromLLM(llmRoute) {
    let total = 0;

    // Add up all daily distances from LLM
    if (llmRoute.day1 && typeof llmRoute.day1.distance === "number") {
      total += llmRoute.day1.distance;
      console.log(`📏 Day 1 distance from LLM: ${llmRoute.day1.distance}km`);
    }

    if (llmRoute.day2 && typeof llmRoute.day2.distance === "number") {
      total += llmRoute.day2.distance;
      console.log(`📏 Day 2 distance from LLM: ${llmRoute.day2.distance}km`);
    }

    // Fallback to totalDistance if individual days not available
    if (
      total === 0 &&
      llmRoute.totalDistance &&
      typeof llmRoute.totalDistance === "number"
    ) {
      total = llmRoute.totalDistance;
      console.log(`📏 Using LLM total distance: ${total}km`);
    }

    // Final fallback for safety
    if (total === 0) {
      console.warn("⚠️ No distance found in LLM route, using default");
      total = 10; // Default reasonable distance
    }

    console.log(`📏 Final LLM total distance: ${total}km`);
    return total;
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
   * Calculate distance between two coordinate pairs
   * @param {Array} coord1 - [lat, lng]
   * @param {Array} coord2 - [lat, lng] 
   * @returns {number} Distance in kilometers
   */
  calculateDistanceBetweenCoords(coord1, coord2) {
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
   * Optimize waypoint order to create a proper circular loop instead of out-and-back
   * @param {Array} waypointCoords - Array of [lat, lng] coordinates
   * @param {Array} geocodedWaypoints - Original waypoint data with names
   * @returns {Array} Reordered waypoint coordinates for optimal loop
   */
  optimizeWaypointsForLoop(waypointCoords, geocodedWaypoints) {
    if (waypointCoords.length <= 2) {
      return waypointCoords; // Can't optimize with 2 or fewer points
    }

    console.log("🔄 Optimizing waypoint order for proper loop formation...");

    // Keep the first waypoint as start
    const startPoint = waypointCoords[0];
    const remainingPoints = waypointCoords.slice(1);

    // Calculate the centroid of all points
    const centroid = this.calculateCentroid(waypointCoords);
    console.log(`📍 Route centroid: [${centroid[0].toFixed(6)}, ${centroid[1].toFixed(6)}]`);

    // Sort remaining points by angle from centroid (creates circular arrangement)
    const pointsWithAngles = remainingPoints.map(point => {
      const angle = Math.atan2(
        point[1] - centroid[1],
        point[0] - centroid[0]
      );
      return { point, angle };
    });

    // Sort by angle to create a circular path
    pointsWithAngles.sort((a, b) => a.angle - b.angle);

    // Find the point closest to the start to begin the loop
    let bestStartIdx = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < pointsWithAngles.length; i++) {
      const dist = this.calculateDistanceBetweenCoords(startPoint, pointsWithAngles[i].point);
      if (dist < minDistance) {
        minDistance = dist;
        bestStartIdx = i;
      }
    }

    // Reorder to start from the closest point and go around the circle
    const reorderedPoints = [
      startPoint,
      ...pointsWithAngles.slice(bestStartIdx),
      ...pointsWithAngles.slice(0, bestStartIdx)
    ].map(p => p.point || p);

    // Check if this creates a better loop than the original order
    const originalLoopScore = this.calculateLoopQualityScore(waypointCoords);
    const optimizedLoopScore = this.calculateLoopQualityScore(reorderedPoints);

    console.log(`📊 Loop quality scores - Original: ${originalLoopScore.toFixed(2)}, Optimized: ${optimizedLoopScore.toFixed(2)}`);

    if (optimizedLoopScore > originalLoopScore) {
      console.log("✅ Using optimized waypoint order for better loop");
      return reorderedPoints;
    } else {
      console.log("ℹ️ Keeping original waypoint order");
      return waypointCoords;
    }
  }

  /**
   * Calculate the centroid of a set of coordinates
   * @param {Array} coordinates - Array of [lat, lng] coordinates
   * @returns {Array} [lat, lng] of centroid
   */
  calculateCentroid(coordinates) {
    const sumLat = coordinates.reduce((sum, coord) => sum + coord[0], 0);
    const sumLng = coordinates.reduce((sum, coord) => sum + coord[1], 0);
    return [sumLat / coordinates.length, sumLng / coordinates.length];
  }

  /**
   * Calculate a quality score for how "loop-like" a path is
   * Higher score = better loop (less retracing)
   * @param {Array} waypoints - Ordered array of waypoint coordinates
   * @returns {number} Loop quality score (0-100)
   */
  calculateLoopQualityScore(waypoints) {
    if (waypoints.length < 3) return 0;

    let score = 100;
    const n = waypoints.length;

    // Penalize if waypoints are too linear
    for (let i = 1; i < n - 1; i++) {
      const angle = this.calculateAngle(
        waypoints[i - 1],
        waypoints[i],
        waypoints[i + 1]
      );
      
      // Angles close to 180° indicate linear arrangement (bad for loops)
      if (Math.abs(angle - 180) < 30) {
        score -= 20; // Heavy penalty for near-straight lines
      }
    }

    // Reward if waypoints form a polygon-like shape
    const centroid = this.calculateCentroid(waypoints);
    const distances = waypoints.map(w => this.calculateDistanceBetweenCoords(w, centroid));
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
    
    // Lower variance = more circular arrangement (good)
    const normalizedVariance = variance / (avgDistance * avgDistance);
    if (normalizedVariance < 0.2) {
      score += 10; // Bonus for circular arrangement
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate angle between three points
   * @param {Array} p1 - First point [lat, lng]
   * @param {Array} p2 - Vertex point [lat, lng]
   * @param {Array} p3 - Third point [lat, lng]
   * @returns {number} Angle in degrees
   */
  calculateAngle(p1, p2, p3) {
    const v1 = [p1[0] - p2[0], p1[1] - p2[1]];
    const v2 = [p3[0] - p2[0], p3[1] - p2[1]];
    
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const det = v1[0] * v2[1] - v1[1] * v2[0];
    
    const angle = Math.atan2(det, dot) * (180 / Math.PI);
    return Math.abs(angle);
  }

  /**
   * Calculate total distance from route data
   * Now prioritizes individual daily distances over totalDistance field
   * @param {Object} route - Route data from LLM
   * @returns {number} Total distance in kilometers
   */
  calculateTotalDistance(route) {
    let total = 0;

    // PRIORITY 1: Sum individual daily distances (most accurate)
    if (route.day1 && typeof route.day1.distance === "number") {
      total += route.day1.distance;
    }

    if (route.day2 && typeof route.day2.distance === "number") {
      total += route.day2.distance;
    }

    // PRIORITY 2: Use totalDistance field if daily distances not available
    if (
      total === 0 &&
      route.totalDistance &&
      typeof route.totalDistance === "number"
    ) {
      total = route.totalDistance;
    }

    // PRIORITY 3: Safe fallback
    if (total === 0) {
      console.warn("⚠️ No distance found in route data, using default 10km");
      total = 10;
    }

    return total;
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
   * Filter waypoints to ensure they're within reasonable distance for trekking
   * @param {Array} geocodedWaypoints - Array of geocoded waypoint objects
   * @param {number} maxTotalDistance - Maximum total distance for the route (km)
   * @returns {Array} Filtered waypoints that form a reasonable trekking route
   */
  filterWaypointsForTrekking(geocodedWaypoints, maxTotalDistance = 15) {
    if (!geocodedWaypoints || geocodedWaypoints.length === 0) {
      return [];
    }

    if (geocodedWaypoints.length === 1) {
      return geocodedWaypoints;
    }

    const startPoint = geocodedWaypoints[0];
    const filtered = [startPoint];
    const maxSegmentDistance = 8; // Max 8km between waypoints
    const maxRadiusFromStart = maxTotalDistance / 2; // Max distance from starting point

    console.log(`🔍 Filtering waypoints - max total: ${maxTotalDistance}km, max segment: ${maxSegmentDistance}km, max radius: ${maxRadiusFromStart}km`);

    for (let i = 1; i < geocodedWaypoints.length; i++) {
      const waypoint = geocodedWaypoints[i];
      const lastFiltered = filtered[filtered.length - 1];
      
      // Check distance from last filtered waypoint
      const segmentDistance = this.calculateDistanceBetweenCoords(
        lastFiltered.coordinates,
        waypoint.coordinates
      );
      
      // Check distance from starting point
      const distanceFromStart = this.calculateDistanceBetweenCoords(
        startPoint.coordinates,
        waypoint.coordinates
      );

      console.log(`📍 ${waypoint.name}: ${segmentDistance.toFixed(1)}km from prev, ${distanceFromStart.toFixed(1)}km from start`);

      // Include waypoint if it's within reasonable distances
      if (segmentDistance <= maxSegmentDistance && distanceFromStart <= maxRadiusFromStart) {
        filtered.push(waypoint);
        console.log(`✓ Included waypoint: ${waypoint.name}`);
      } else {
        console.log(`✗ Excluded waypoint: ${waypoint.name} (segment: ${segmentDistance.toFixed(1)}km, radius: ${distanceFromStart.toFixed(1)}km)`);
      }
    }

    // Estimate total distance of filtered route
    let totalDistance = 0;
    for (let i = 0; i < filtered.length - 1; i++) {
      totalDistance += this.calculateDistanceBetweenCoords(
        filtered[i].coordinates,
        filtered[i + 1].coordinates
      );
    }
    
    // Add return distance to start (for circular route)
    if (filtered.length > 1) {
      totalDistance += this.calculateDistanceBetweenCoords(
        filtered[filtered.length - 1].coordinates,
        filtered[0].coordinates
      );
    }

    console.log(`📏 Filtered route estimated distance: ${totalDistance.toFixed(1)}km (${filtered.length} waypoints)`);

    // If still too long, keep only the closest waypoints
    if (totalDistance > maxTotalDistance && filtered.length > 2) {
      console.log(`⚠️ Route still too long, keeping only closest waypoints`);
      const closest = [startPoint];
      
      // Sort remaining waypoints by distance from start
      const sortedByDistance = filtered.slice(1).sort((a, b) => {
        const distA = this.calculateDistanceBetweenCoords(startPoint.coordinates, a.coordinates);
        const distB = this.calculateDistanceBetweenCoords(startPoint.coordinates, b.coordinates);
        return distA - distB;
      });
      
      // Add closest waypoints until we approach the distance limit
      let runningDistance = 0;
      for (const waypoint of sortedByDistance) {
        const distanceToAdd = this.calculateDistanceBetweenCoords(
          closest[closest.length - 1].coordinates,
          waypoint.coordinates
        );
        
        if (runningDistance + distanceToAdd < maxTotalDistance * 0.8) {
          closest.push(waypoint);
          runningDistance += distanceToAdd;
        }
      }
      
      console.log(`✓ Final filtered route: ${closest.length} waypoints, ~${runningDistance.toFixed(1)}km`);
      return closest;
    }

    return filtered;
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
      clientInitialized: !!this.genAI,
      sdkVersion: "new_genai_2024",
      features: [
        "Enhanced geographic knowledge",
        "Realistic distance validation",
        "Real road/trail routing integration",
        "Dual model fallback system",
        "Thinking mode for 2.5 series models",
        "Optimized thinking budget (1024 tokens)",
      ],
    };
  }
}

module.exports = new LLMService();
