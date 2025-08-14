const { InferenceClient } = require("@huggingface/inference");
const imageService = require("./imageService");
const geocodingService = require("./geocodingService");

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
   * Generate a trip route using LLM with multiple provider fallback
   * @param {string} country - Country/region for the trip
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {string} city - Optional city specification
   * @returns {Object} Generated route data
   */
  async generateRoute(country, tripType, city = null) {
    const startTime = Date.now();

    try {
      // Build the prompt based on trip type
      const prompt = this.buildRoutePrompt(country, tripType, city);
      console.log("Generated prompt:", prompt);

      // Try each model in the chain until one succeeds
      let lastError = null;

      for (let i = 0; i < this.modelChain.length; i++) {
        const model = this.modelChain[i];
        console.log(`Attempting route generation with model: ${model}`);

        try {
          const result = await this.callLLMWithRetry(prompt, model);
          const processedRoute = await this.processLLMResponse(
            result,
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
   * Build the route generation prompt based on trip type and location
   * @param {string} country - Country/region
   * @param {string} tripType - 'cycling' or 'trekking'
   * @param {string} city - Optional city
   * @returns {string} Formatted prompt
   */
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

  /**
   * Call LLM with retry mechanism using modern InferenceClient
   * @param {string} prompt - The prompt to send
   * @param {string} model - Model to use
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {string} LLM response
   */
  async callLLMWithRetry(prompt, model, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} for model ${model}`);

        // Use the modern chatCompletion method for better results
        const response = await this.hf.chatCompletion({
          model: model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 0.9,
          // Use auto provider selection by default
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

        // If this is a chat completion error, try with textGeneration as fallback
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

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }

  /**
   * Process and validate LLM response
   * @param {string} llmResponse - Raw LLM response
   * @param {string} tripType - Type of trip
   * @param {string} country - Country name
   * @param {string} city - City name
   * @returns {Object} Processed route data
   */
  async processLLMResponse(llmResponse, tripType, country, city) {
    try {
      // Extract JSON from the response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in LLM response");
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      // Validate the response structure
      if (!parsedResponse.route) {
        throw new Error("Invalid response structure: missing 'route' field");
      }

      const route = parsedResponse.route;

      // Validate required fields based on trip type
      this.validateRouteData(route, tripType);

      // Generate realistic coordinates using geocoding service
      const coordinates = await this.generateRealisticCoordinates(
        country,
        city,
        route,
        tripType
      );

      // Transform to our internal format
      const processedRoute = {
        country: country,
        city: city,
        tripType: tripType,
        routeData: {
          coordinates: coordinates,
          waypoints: this.extractAllWaypoints(route),
          dailyRoutes: this.formatDailyRoutes(route, tripType),
          totalDistance:
            route.totalDistance || this.calculateTotalDistance(route),
          estimatedDuration:
            route.estimatedDuration || this.getDefaultDuration(tripType),
          difficulty: route.difficulty || "moderate",
        },
      };

      console.log("Route processed successfully:", processedRoute.routeData);
      return processedRoute;
    } catch (error) {
      console.error("Error processing LLM response:", error);
      console.error("Raw LLM response:", llmResponse);
      throw new Error(`Failed to process LLM response: ${error.message}`);
    }
  }

  /**
   * Generate realistic coordinates using geocoding service
   * @param {string} country - Country name
   * @param {string} city - City name (optional)
   * @param {Object} route - Route data from LLM
   * @param {string} tripType - 'cycling' or 'trekking'
   * @returns {Array} Array of [lat, lng] coordinates
   */
  async generateRealisticCoordinates(country, city, route, tripType) {
    try {
      console.log("Generating realistic coordinates for route...");

      // Extract waypoints from the route data
      const waypoints = this.extractWaypointsFromRoute(route, country, city);

      if (waypoints.length === 0) {
        console.warn("No waypoints found, falling back to mock coordinates");
        return this.generateMockCoordinates(country, city, route);
      }

      console.log("Extracted waypoints:", waypoints);

      // Use geocoding service to generate realistic route coordinates
      const coordinates = await geocodingService.generateRouteCoordinates(
        waypoints,
        tripType
      );

      console.log(`Generated ${coordinates.length} realistic coordinates`);
      return coordinates;
    } catch (error) {
      console.error(
        "Geocoding failed, falling back to mock coordinates:",
        error.message
      );

      // Fallback to mock coordinates if geocoding fails
      return this.generateMockCoordinates(country, city, route);
    }
  }

  /**
   * Extract waypoints from LLM route data in correct order
   * @param {Object} route - Route data from LLM
   * @param {string} country - Country name
   * @param {string} city - City name (optional)
   * @returns {Array} Array of location strings for geocoding
   */
  extractWaypointsFromRoute(route, country, city) {
    const waypoints = [];

    try {
      if (route.day1) {
        // Add starting point
        if (route.day1.start) {
          waypoints.push(
            this.formatLocationForGeocoding(route.day1.start, country)
          );
        }

        // Add day 1 waypoints
        if (route.day1.waypoints && route.day1.waypoints.length > 0) {
          route.day1.waypoints.forEach((waypoint) => {
            waypoints.push(this.formatLocationForGeocoding(waypoint, country));
          });
        }

        // Add day 1 end point
        if (route.day1.end && route.day1.end !== route.day1.start) {
          waypoints.push(
            this.formatLocationForGeocoding(route.day1.end, country)
          );
        }
      }

      // For cycling routes, add day 2 waypoints
      if (route.day2) {
        // Day 2 start should be same as day 1 end, so skip it

        // Add day 2 waypoints
        if (route.day2.waypoints && route.day2.waypoints.length > 0) {
          route.day2.waypoints.forEach((waypoint) => {
            waypoints.push(this.formatLocationForGeocoding(waypoint, country));
          });
        }

        // Add day 2 end point
        if (route.day2.end) {
          waypoints.push(
            this.formatLocationForGeocoding(route.day2.end, country)
          );
        }
      }

      // Remove duplicates while preserving order
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
   * Format location for geocoding by adding country context
   * @param {string} location - Location name from LLM
   * @param {string} country - Country name for context
   * @returns {string} Formatted location string
   */
  formatLocationForGeocoding(location, country) {
    if (!location) return "";

    // Clean up the location string
    const cleanLocation = location.trim();

    // If location already contains country, return as-is
    if (cleanLocation.toLowerCase().includes(country.toLowerCase())) {
      return cleanLocation;
    }

    // Add country context for better geocoding accuracy
    return `${cleanLocation}, ${country}`;
  }

  /**
   * Generate mock coordinates (fallback when geocoding fails)
   * @param {string} country - Country name
   * @param {string} city - City name (optional)
   * @param {Object} route - Route data
   * @returns {Array} Array of [lat, lng] coordinates
   */
  generateMockCoordinates(country, city, route) {
    console.log("Using fallback mock coordinates");

    // Get base coordinates for the country
    const baseCoords = this.getCountryBaseCoordinates(country);

    const coordinates = [];
    const numPoints = 15; // Generate more points for smoother routes

    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);

      // Create a more realistic mock route pattern
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
   * Validate route data structure and constraints
   */
  validateRouteData(route, tripType) {
    if (!route.day1) {
      throw new Error("Missing day1 route data");
    }

    // Validate cycling-specific constraints
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

    // Validate trekking-specific constraints
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

  /**
   * Extract all waypoints from the route
   */
  extractAllWaypoints(route) {
    const waypoints = [];

    if (route.day1 && route.day1.waypoints) {
      waypoints.push(...route.day1.waypoints);
    }

    if (route.day2 && route.day2.waypoints) {
      waypoints.push(...route.day2.waypoints);
    }

    return waypoints;
  }

  /**
   * Format daily routes for our schema
   */
  formatDailyRoutes(route, tripType) {
    const dailyRoutes = [];

    // Day 1
    if (route.day1) {
      dailyRoutes.push({
        day: 1,
        startPoint: route.day1.start,
        endPoint: route.day1.end,
        distance: route.day1.distance,
        coordinates: [], // Will be populated later
        waypoints: route.day1.waypoints || [],
      });
    }

    // Day 2 (only for cycling)
    if (tripType === "cycling" && route.day2) {
      dailyRoutes.push({
        day: 2,
        startPoint: route.day2.start,
        endPoint: route.day2.end,
        distance: route.day2.distance,
        coordinates: [], // Will be populated later
        waypoints: route.day2.waypoints || [],
      });
    }

    return dailyRoutes;
  }

  /**
   * Calculate total distance from daily routes
   */
  calculateTotalDistance(route) {
    let total = 0;
    if (route.day1 && route.day1.distance) total += route.day1.distance;
    if (route.day2 && route.day2.distance) total += route.day2.distance;
    return total;
  }

  /**
   * Get default duration based on trip type
   */
  getDefaultDuration(tripType) {
    return tripType === "cycling" ? "2 days" : "1 day";
  }

  /**
   * Get approximate base coordinates for a country (used for fallback)
   * @param {string} country - Country name
   * @returns {Array} [lat, lng] coordinates
   */
  getCountryBaseCoordinates(country) {
    const countryCoords = {
      // European countries
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

      // North American countries
      "united states": [39.8283, -98.5795],
      usa: [39.8283, -98.5795],
      canada: [56.1304, -106.3468],
      mexico: [23.6345, -102.5528],

      // Other popular destinations
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
    return [50.0, 10.0]; // Default to central Europe
  }
}

module.exports = new LLMService();
