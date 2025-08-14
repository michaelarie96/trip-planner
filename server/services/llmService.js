const { InferenceClient } = require("@huggingface/inference");
const imageService = require("./imageService");
const geocodingService = require("./geocodingService");
const routingService = require("./routingService");

class LLMService {
  constructor() {
    // Initialize Hugging Face client
    this.hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

    // Configure models with fallback chain
    this.primaryModel =
      process.env.PRIMARY_LLM_MODEL || "meta-llama/Llama-3.2-3B-Instruct";
    this.fallbackModels = process.env.FALLBACK_LLM_MODELS
      ? process.env.FALLBACK_LLM_MODELS.split(",")
      : ["microsoft/DialoGPT-medium"];

    // All available models in order of preference
    this.modelChain = [this.primaryModel, ...this.fallbackModels];

    console.log("LLM Service initialized with models:", this.modelChain);
  }

  /**
   * Generate a trip route using LLM with real routing integration
   * @param {string} country - Country/region for the trip
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {string} city - Optional city specification
   * @returns {Object} Generated route data with real coordinates
   */
  async generateRoute(country, tripType, city = null) {
    const startTime = Date.now();

    try {
      // Build the prompt based on trip type
      const prompt = this.buildRoutePrompt(country, tripType, city);
      console.log("Generated prompt for LLM");

      // Try each model in the chain until one succeeds
      let lastError = null;

      for (let i = 0; i < this.modelChain.length; i++) {
        const model = this.modelChain[i];
        console.log(`Attempting route generation with model: ${model}`);

        try {
          const llmResult = await this.callLLMWithRetry(prompt, model);
          console.log("LLM generated route structure successfully");

          const processedRoute = await this.processLLMResponseWithRealRouting(
            llmResult,
            tripType,
            country,
            city
          );

          const processingTime = Date.now() - startTime;
          console.log(
            `Route generated successfully with ${model} in ${processingTime}ms`
          );

          // Try to get a representative image for the country
          let imageData = null;
          try {
            console.log("Fetching country image...");
            imageData = await imageService.getImage(country, city);
            console.log("Country image retrieved successfully");
          } catch (imageError) {
            console.warn("Failed to get country image:", imageError.message);
            // Don't fail route generation if image fails
          }

          return {
            ...processedRoute,
            imageUrl: imageData?.imageUrl || null,
            imageData: imageData || null,
            generationMetadata: {
              llmModel: model,
              prompt: prompt,
              processingTime: processingTime,
              generatedAt: new Date(),
              attemptNumber: i + 1,
              imageRetrieved: !!imageData,
              routingMethod:
                processedRoute.routingMetadata?.method || "fallback",
            },
          };
        } catch (error) {
          console.warn(`Model ${model} failed:`, error.message);
          lastError = error;

          // If this isn't the last model, continue to next
          if (i < this.modelChain.length - 1) {
            console.log(`Falling back to next model...`);
            continue;
          }
        }
      }

      // If all models failed, throw the last error
      throw new Error(
        `All LLM models failed. Last error: ${
          lastError?.message || "Unknown error"
        }`
      );
    } catch (error) {
      console.error("LLM Route Generation Error:", error);
      throw new Error(`Failed to generate route: ${error.message}`);
    }
  }

  /**
   * Process LLM response and generate real routing coordinates
   * @param {string} llmResponse - Raw LLM response
   * @param {string} tripType - Type of trip
   * @param {string} country - Country name
   * @param {string} city - City name
   * @returns {Object} Processed route data with real coordinates
   */
  async processLLMResponseWithRealRouting(
    llmResponse,
    tripType,
    country,
    city
  ) {
    try {
      console.log("Processing LLM response with real routing...");

      // Extract and validate LLM JSON response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in LLM response");
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      if (!parsedResponse.route) {
        throw new Error("Invalid response structure: missing 'route' field");
      }

      const route = parsedResponse.route;
      this.validateRouteData(route, tripType);

      console.log("LLM route structure validated successfully");

      // Extract waypoints from LLM response
      const waypointNames = this.extractWaypointsFromRoute(
        route,
        country,
        city
      );
      console.log("Extracted waypoints:", waypointNames);

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
        `Route processed successfully: ${processedRoute.routeData.totalDistance}km with ${processedRoute.routeData.coordinates.length} coordinates`
      );
      return processedRoute;
    } catch (error) {
      console.error("Error processing LLM response with routing:", error);
      console.error("Raw LLM response:", llmResponse);
      throw new Error(`Failed to process LLM response: ${error.message}`);
    }
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

  // Keep existing methods that don't need changes
  buildRoutePrompt(country, tripType, city) {
    const location = city ? `${city}, ${country}` : country;

    if (tripType === "cycling") {
      return `Generate a realistic 2-day cycling route in ${location}.

Requirements:
- 2 consecutive days of cycling
- Maximum 60km per day
- City-to-city route (different start and end points for each day)
- Follow actual roads and cycling paths
- Include specific city/landmark names
- Provide realistic distances in kilometers

Return ONLY a JSON object in this exact format:
{
  "route": {
    "day1": {
      "start": "Starting City/Location",
      "end": "Ending City/Location", 
      "distance": 45,
      "waypoints": ["Landmark 1", "Town A", "Landmark 2"]
    },
    "day2": {
      "start": "Day 1 ending location",
      "end": "Final destination",
      "distance": 55,
      "waypoints": ["Landmark 3", "Town B", "Landmark 4"]
    },
    "totalDistance": 100,
    "estimatedDuration": "2 days",
    "difficulty": "moderate"
  }
}`;
    } else {
      return `Generate a realistic trekking route in ${location}.

Requirements:
- Single day circular route (start and end at same point)
- Distance between 5-15km
- Follow actual hiking trails and paths
- Include specific landmarks and trail names
- Provide realistic distance in kilometers

Return ONLY a JSON object in this exact format:
{
  "route": {
    "day1": {
      "start": "Starting Point/Trailhead",
      "end": "Starting Point/Trailhead",
      "distance": 12,
      "waypoints": ["Trail Junction 1", "Summit/Viewpoint", "Lake/Landmark", "Trail Junction 2"]
    },
    "totalDistance": 12,
    "estimatedDuration": "1 day",
    "difficulty": "moderate"
  }
}`;
    }
  }

  async callLLMWithRetry(prompt, model, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} for model ${model}`);

        const response = await this.hf.chatCompletion({
          model: model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 0.9,
          provider: "auto",
        });

        if (
          !response ||
          !response.choices ||
          !response.choices[0] ||
          !response.choices[0].message
        ) {
          throw new Error("Empty or invalid response from LLM");
        }

        return response.choices[0].message.content;
      } catch (error) {
        console.warn(`Attempt ${attempt} failed for ${model}:`, error.message);
        lastError = error;

        if (attempt === 1 && error.message.includes("chat")) {
          try {
            console.log(`Trying textGeneration fallback for ${model}`);
            const textResponse = await this.hf.textGeneration({
              model: model,
              inputs: prompt,
              parameters: {
                max_new_tokens: 1000,
                temperature: 0.7,
                top_p: 0.9,
                do_sample: true,
                stop: ["Human:", "User:", "\n\nHuman", "\n\nUser"],
              },
            });

            if (!textResponse || !textResponse.generated_text) {
              throw new Error("Empty response from LLM textGeneration");
            }

            return textResponse.generated_text;
          } catch (textError) {
            console.warn(
              "textGeneration fallback also failed:",
              textError.message
            );
            lastError = textError;
          }
        }

        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }

  validateRouteData(route, tripType) {
    if (!route.day1) {
      throw new Error("Missing day1 route data");
    }

    if (tripType === "cycling") {
      if (!route.day2) {
        throw new Error("Cycling routes must have day2 data");
      }

      if (route.day1.distance > 60 || route.day2.distance > 60) {
        throw new Error("Cycling route exceeds 60km per day limit");
      }

      if (route.day1.start === route.day1.end) {
        throw new Error("Cycling route day1 start and end should be different");
      }
    }

    if (tripType === "trekking") {
      if (route.day1.distance < 5 || route.day1.distance > 15) {
        console.warn(
          "Trekking route distance outside 5-15km range:",
          route.day1.distance
        );
      }

      if (route.day1.start !== route.day1.end) {
        console.warn("Trekking route should be circular (same start/end)");
      }
    }
  }

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

  formatLocationForGeocoding(location, country) {
    if (!location) return "";

    const cleanLocation = location.trim();

    if (cleanLocation.toLowerCase().includes(country.toLowerCase())) {
      return cleanLocation;
    }

    return `${cleanLocation}, ${country}`;
  }

  calculateTotalDistance(route) {
    let total = 0;
    if (route.day1 && route.day1.distance) total += route.day1.distance;
    if (route.day2 && route.day2.distance) total += route.day2.distance;
    return total || route.totalDistance || 0;
  }

  getDefaultDuration(tripType) {
    return tripType === "cycling" ? "2 days" : "1 day";
  }

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
}

module.exports = new LLMService();
