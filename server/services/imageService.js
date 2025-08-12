const axios = require("axios");

class ImageService {
  constructor() {
    this.apiKey = process.env.UNSPLASH_API_KEY;
    this.baseUrl = "https://api.unsplash.com";

    if (!this.apiKey) {
      console.error("Unsplash API key not found in environment variables");
    }

    // Rate limiting info for Unsplash free tier
    this.rateLimit = {
      hourly: 50, // 50 requests per hour for free tier
      remaining: 50,
      resetTime: null,
    };
  }

  /**
   * Get a representative image for a country/+city
   * @param {string} country - Country name
   * @param {string} city - Optional city name for more specific results
   * @returns {Object} Image data with URLs and metadata
   */
  async getImage(country, city = null) {
    try {
      console.log(`Fetching image for: ${city ? `${city}, ` : ""}${country}`);

      // Build search query with fallbacks
      const searchQueries = this.buildSearchQueries(country, city);

      let imageData = null;
      let usedQuery = null;

      // Try each search query until we get results
      for (const query of searchQueries) {
        try {
          imageData = await this.searchUnsplash(query);
          if (imageData) {
            usedQuery = query;
            break;
          }
        } catch (error) {
          console.warn(`Search failed for query "${query}":`, error.message);
          // Continue to next query
        }
      }

      if (!imageData) {
        throw new Error("No images found for any search queries");
      }

      console.log(`Image found using query: "${usedQuery}"`);

      return {
        imageUrl: imageData.urls.regular, // Main image URL
        thumbnailUrl: imageData.urls.small,
        largeUrl: imageData.urls.full,
        description: imageData.alt_description || `${country} landscape`,
        photographer: {
          name: imageData.user.name,
          username: imageData.user.username,
          profileUrl: `https://unsplash.com/@${imageData.user.username}`,
        },
        unsplashUrl: imageData.links.html,
        searchQuery: usedQuery,
        source: "Unsplash",
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Image service error:", error.message);
      throw this.handleImageError(error, country);
    }
  }

  /**
   * Build search queries with fallbacks for better results
   * @param {string} country - Country name
   * @param {string} city - Optional city name
   * @returns {Array} Array of search queries in order of preference
   */
  buildSearchQueries(country, city) {
    const queries = [];

    // If city is provided, try city-specific searches first
    if (city) {
      queries.push(`${city} ${country} landscape`);
      queries.push(`${city} ${country} cityscape`);
      queries.push(`${city} architecture`);
    }

    // Country-specific searches
    queries.push(`${country} landscape nature`);
    queries.push(`${country} travel destination`);
    queries.push(`${country} scenic view`);
    queries.push(`${country} tourism`);

    // Broader fallbacks
    queries.push(country);

    return queries;
  }

  /**
   * Search Unsplash API for images
   * @param {string} query - Search query
   * @returns {Object|null} First image result or null
   */
  async searchUnsplash(query) {
    const url = `${this.baseUrl}/search/photos`;

    const params = {
      query: query,
      page: 1,
      per_page: 3, // Get multiple results to have options
      orientation: "landscape", // Prefer landscape orientation for country images
      order_by: "popular", // Get popular/high-quality images
    };

    const headers = {
      Authorization: `Client-ID ${this.apiKey}`,
      "Accept-Version": "v1",
      "User-Agent": "TripPlanner-App/1.0",
    };

    try {
      const response = await axios.get(url, {
        params,
        headers,
        timeout: 10000, // 10 second timeout
      });

      // Update rate limit info from response headers
      this.updateRateLimit(response.headers);

      if (response.data.results && response.data.results.length > 0) {
        // Return the first high-quality result
        return this.selectBestImage(response.data.results);
      }

      return null;
    } catch (error) {
      if (error.response && error.response.status === 403) {
        throw new Error("Unsplash API rate limit exceeded");
      }
      throw error;
    }
  }

  /**
   * Select the best image from search results
   * @param {Array} results - Array of image results
   * @returns {Object} Best image result
   */
  selectBestImage(results) {
    // Filter for good quality images
    const qualityImages = results.filter(
      (img) =>
        img.width >= 1000 && // Minimum width
        img.height >= 600 && // Minimum height
        img.likes > 5 // Has some likes (quality indicator)
    );

    // Return the first quality image, or first result if none meet criteria
    return qualityImages.length > 0 ? qualityImages[0] : results[0];
  }

  /**
   * Update rate limit tracking from response headers
   * @param {Object} headers - Response headers
   */
  updateRateLimit(headers) {
    if (headers["x-ratelimit-remaining"]) {
      this.rateLimit.remaining = parseInt(headers["x-ratelimit-remaining"]);
    }
    if (headers["x-ratelimit-reset"]) {
      this.rateLimit.resetTime = new Date(headers["x-ratelimit-reset"] * 1000);
    }

    console.log(`Unsplash API calls remaining: ${this.rateLimit.remaining}`);
  }

  /**
   * Handle and format image API errors
   * @param {Error} error - Original error
   * @param {string} country - Country that was searched
   * @returns {Error} Formatted error
   */
  handleImageError(error, country) {
    if (error.response) {
      const status = error.response.status;

      switch (status) {
        case 401:
          return new Error("Invalid Unsplash API key");
        case 403:
          return new Error(
            "Unsplash API rate limit exceeded - try again later"
          );
        case 404:
          return new Error(`No images found for ${country}`);
        default:
          return new Error(
            `Unsplash API error: ${
              error.response.data?.errors?.[0] || "Unknown error"
            }`
          );
      }
    } else if (error.code === "ECONNABORTED") {
      return new Error("Image search timeout - please try again");
    } else {
      return new Error(`Image service error: ${error.message}`);
    }
  }

  /**
   * Get current API usage status
   * @returns {Object} Rate limit information
   */
  getApiStatus() {
    return {
      remaining: this.rateLimit.remaining,
      resetTime: this.rateLimit.resetTime,
      hasApiKey: !!this.apiKey,
    };
  }
}

module.exports = new ImageService();
