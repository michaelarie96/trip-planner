const express = require("express");
const imageService = require("../services/imageService");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Apply authentication middleware to all image endpoints
router.use(authenticateToken);

/**
 * Get representative image for a country/city
 * Optional query parameter: city
 */
router.get("/country/:country", async (req, res) => {
  try {
    const { country } = req.params;
    const { city } = req.query;

    // Validate country parameter
    if (!country || country.trim() === "") {
      return res.status(400).json({
        message: "Country parameter is required",
        example: "GET /api/images/country/france?city=paris",
      });
    }

    console.log(
      `Image requested for: ${city ? `${city}, ` : ""}${country} by user: ${
        req.user.name
      }`
    );

    // Get image from service
    const imageData = await imageService.getImage(
      country.trim(),
      city ? city.trim() : null
    );

    res.json({
      message: "Image retrieved successfully",
      image: imageData,
      requestedLocation: {
        country: country,
        city: city || null,
      },
    });
  } catch (error) {
    console.error("Image retrieval error:", error.message);

    // Handle specific error types
    if (error.message.includes("Invalid Unsplash API key")) {
      return res.status(503).json({
        message: "Image service temporarily unavailable",
        error: "API configuration issue",
      });
    }

    if (error.message.includes("rate limit")) {
      return res.status(429).json({
        message: "Image service rate limit exceeded",
        error: "Please try again later",
        retryAfter: "1 hour",
      });
    }

    if (error.message.includes("No images found")) {
      return res.status(404).json({
        message: "No images found for location",
        error: `Unable to find representative images for ${country}`,
        requestedLocation: { country, city: req.query.city || null },
      });
    }

    // Generic error response
    res.status(500).json({
      message: "Error retrieving image",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Image service error",
    });
  }
});

// Get API status and rate limit information
router.get("/status", (req, res) => {
  try {
    const status = imageService.getApiStatus();

    res.json({
      message: "Image service status",
      status: {
        hasApiKey: status.hasApiKey,
        remainingRequests: status.remaining,
        resetTime: status.resetTime,
        serviceActive: status.hasApiKey,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error getting service status",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Service error",
    });
  }
});

module.exports = router;
