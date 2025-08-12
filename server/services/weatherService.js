const axios = require("axios");

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.baseUrl = "https://api.openweathermap.org/data/2.5";

    if (!this.apiKey) {
      console.error(
        "OpenWeatherMap API key not found in environment variables"
      );
    }
  }

  /**
   * Get 3-day weather forecast for a location
   * @param {string} location - City name or "lat,lon" coordinates
   * @returns {Object} Weather forecast data
   */
  async getWeatherForecast(location) {
    try {
      console.log(`Fetching weather for location: ${location}`);

      // Build API URL for 3-day forecast
      const url = this.buildForecastUrl(location);

      // Make API call with timeout
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          "User-Agent": "TripPlanner-App/1.0",
        },
      });

      // Process the response
      const processedWeather = this.processForecastData(response.data);

      console.log(`Weather data retrieved successfully for ${location}`);
      return processedWeather;
    } catch (error) {
      console.error("Weather API Error:", error.message);
      throw this.handleWeatherError(error);
    }
  }

  /**
   * Build the OpenWeatherMap API URL
   * @param {string} location - Location string
   * @returns {string} Complete API URL
   */
  buildForecastUrl(location) {
    let url = `${this.baseUrl}/forecast?`;

    // Check if location is coordinates (lat,lon format)
    const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*$/;

    if (coordPattern.test(location)) {
      const [lat, lon] = location.split(",");
      url += `lat=${lat}&lon=${lon}`;
    } else {
      // Treat as city name
      url += `q=${encodeURIComponent(location)}`;
    }

    // Add API parameters
    url += `&appid=${this.apiKey}`;
    url += `&units=metric`; // Celsius temperature
    url += `&cnt=24`; // 24 forecast periods (3 days, 8 per day)

    return url;
  }

  /**
   * Process raw OpenWeatherMap data into our format
   * @param {Object} data - Raw API response
   * @returns {Object} Processed weather data
   */
  processForecastData(data) {
    if (!data.list || data.list.length === 0) {
      throw new Error("No forecast data received from weather API");
    }

    // Group forecast data by days (next 3 days)
    const dailyForecasts = this.groupByDays(data.list);

    return {
      location: {
        name: data.city.name,
        country: data.city.country,
        coordinates: {
          lat: data.city.coord.lat,
          lon: data.city.coord.lon,
        },
      },
      forecast: dailyForecasts,
      source: "OpenWeatherMap",
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Group forecast data by days
   * @param {Array} forecastList - List of forecast periods
   * @returns {Array} Array of daily forecasts
   */
  groupByDays(forecastList) {
    const days = [];
    const today = new Date();

    // Process next 3 days
    for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      const targetDateString = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

      // Find forecasts for this day (around noon for best representation)
      const dayForecasts = forecastList.filter((item) => {
        const itemDate = new Date(item.dt * 1000).toISOString().split("T")[0];
        return itemDate === targetDateString;
      });

      if (dayForecasts.length > 0) {
        // Pick the forecast closest to noon (12:00)
        const noonForecast = this.findNoonForecast(dayForecasts);

        days.push({
          date: targetDateString,
          dayName: targetDate.toLocaleDateString("en-US", { weekday: "long" }),
          weather: {
            temperature: {
              current: Math.round(noonForecast.main.temp),
              min: Math.round(
                Math.min(...dayForecasts.map((f) => f.main.temp_min))
              ),
              max: Math.round(
                Math.max(...dayForecasts.map((f) => f.main.temp_max))
              ),
              feelsLike: Math.round(noonForecast.main.feels_like),
            },
            condition: noonForecast.weather[0].main,
            description: this.capitalizeDescription(
              noonForecast.weather[0].description
            ),
            icon: noonForecast.weather[0].icon,
            humidity: noonForecast.main.humidity,
            windSpeed: Math.round(noonForecast.wind.speed * 3.6), // Convert m/s to km/h
            cloudiness: noonForecast.clouds.all,
            precipitation: noonForecast.rain ? noonForecast.rain["3h"] || 0 : 0,
          },
        });
      }
    }

    return days;
  }

  /**
   * Find forecast closest to noon time
   * @param {Array} dayForecasts - Forecasts for a specific day
   * @returns {Object} Forecast closest to noon
   */
  findNoonForecast(dayForecasts) {
    // Find the forecast closest to 12:00 (noon)
    return dayForecasts.reduce((closest, current) => {
      const currentHour = new Date(current.dt * 1000).getHours();
      const closestHour = new Date(closest.dt * 1000).getHours();

      const currentDiff = Math.abs(currentHour - 12);
      const closestDiff = Math.abs(closestHour - 12);

      return currentDiff < closestDiff ? current : closest;
    });
  }

  /**
   * Capitalize weather description
   * @param {string} description - Weather description
   * @returns {string} Capitalized description
   */
  capitalizeDescription(description) {
    return description
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Handle and format weather API errors
   * @param {Error} error - Original error
   * @returns {Error} Formatted error
   */
  handleWeatherError(error) {
    if (error.response) {
      // API responded with error status
      const status = error.response.status;
      const message = error.response.data?.message || "Weather API error";

      switch (status) {
        case 401:
          return new Error("Invalid weather API key");
        case 404:
          return new Error("Location not found");
        case 429:
          return new Error("Weather API rate limit exceeded");
        default:
          return new Error(`Weather API error: ${message}`);
      }
    } else if (error.code === "ECONNABORTED") {
      return new Error("Weather API timeout - please try again");
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return new Error("Unable to connect to weather service");
    } else {
      return new Error(`Weather service error: ${error.message}`);
    }
  }

  /**
   * Get current weather for a location (simpler, single call)
   * @param {string} location - City name or coordinates
   * @returns {Object} Current weather data
   */
  async getCurrentWeather(location) {
    try {
      let url = `${this.baseUrl}/weather?`;

      // Handle coordinates vs city name
      const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*$/;
      if (coordPattern.test(location)) {
        const [lat, lon] = location.split(",");
        url += `lat=${lat}&lon=${lon}`;
      } else {
        url += `q=${encodeURIComponent(location)}`;
      }

      url += `&appid=${this.apiKey}&units=metric`;

      const response = await axios.get(url, { timeout: 8000 });

      return {
        location: {
          name: response.data.name,
          country: response.data.sys.country,
        },
        weather: {
          temperature: Math.round(response.data.main.temp),
          condition: response.data.weather[0].main,
          description: this.capitalizeDescription(
            response.data.weather[0].description
          ),
          icon: response.data.weather[0].icon,
          humidity: response.data.main.humidity,
          windSpeed: Math.round(response.data.wind.speed * 3.6),
        },
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw this.handleWeatherError(error);
    }
  }
}

module.exports = new WeatherService();
