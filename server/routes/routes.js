const express = require("express");
const Route = require("../models/route");
const llmService = require("../services/llmService");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Apply authentication middleware to all route endpoints
router.use(authenticateToken);

// Generate new route using LLM
router.post("/generate", async (req, res) => {
  try {
    const { country, tripType, city } = req.body;

    // Validate required fields
    if (!country || !tripType) {
      return res.status(400).json({
        message: "Country and trip type are required",
        details: {
          country: !country ? "Country is required" : null,
          tripType: !tripType ? "Trip type is required" : null,
        },
      });
    }

    // Validate trip type
    if (!["cycling", "trekking"].includes(tripType)) {
      return res.status(400).json({
        message: "Trip type must be either 'cycling' or 'trekking'",
      });
    }

    console.log(`Generating ${tripType} route for ${city || country}`);

    // Generate route using LLM service
    const generatedRoute = await llmService.generateRoute(
      country,
      tripType,
      city
    );

    // Return the generated route data (not saved to database yet)
    res.json({
      message: "Route generated successfully",
      route: generatedRoute,
      generated: true,
      saved: false,
    });
  } catch (error) {
    console.error("Route generation error:", error);

    // Handle different types of errors
    if (error.message.includes("Failed to generate route")) {
      return res.status(503).json({
        message: "Route generation service temporarily unavailable",
        error: "Please try again in a few moments",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    res.status(500).json({
      message: "Error generating route",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Save generated route to database
router.post("/save", async (req, res) => {
  try {
    const {
      name,
      description,
      country,
      city,
      tripType,
      routeData,
      imageUrl,
      generationData,
    } = req.body;

    // Validate required fields
    if (!name || !country || !tripType || !routeData) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["name", "country", "tripType", "routeData"],
      });
    }

    // Create new route object
    const routeObj = {
      name: name.trim(),
      description: description.trim(),
      userId: req.user._id, // From JWT authentication middleware
      country: country.trim(),
      tripType,
      routeData,
      imageUrl,
    };

    // Add optional fields
    if (city) routeObj.city = city.trim();
    if (generationData) routeObj.generationData = generationData;

    // Create and save route
    const route = new Route(routeObj);
    await route.save();

    console.log(`Route "${name}" saved for user ${req.user.name}`);

    // Return saved route with summary
    res.status(201).json({
      message: "Route saved successfully",
      route: {
        id: route._id,
        name: route.name,
        description: route.description,
        country: route.country,
        city: route.city,
        tripType: route.tripType,
        totalDistance: route.routeData.totalDistance,
        estimatedDuration: route.routeData.estimatedDuration,
        createdAt: route.createdAt,
      },
      saved: true,
    });
  } catch (error) {
    console.error("Route save error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: "Validation failed",
        errors: messages,
      });
    }

    res.status(500).json({
      message: "Error saving route",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Get all routes for the authenticated user
router.get("/user", async (req, res) => {
  try {
    const { limit = 10, page = 1, tripType } = req.query;

    // Build query filter
    const filter = { userId: req.user._id };
    if (tripType && ["cycling", "trekking"].includes(tripType)) {
      filter.tripType = tripType;
    }

    console.log("Filter for user routes:", filter);
    console.log("User ID from token:", req.user._id);

    // Calculate pagination
    const limitNum = Math.min(parseInt(limit) || 10, 50); // Max 50 routes per request
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;

    // Get routes with pagination
    const routes = await Route.find(filter)
      .sort({ createdAt: -1 }) // Most recent first
      .limit(limitNum)
      .skip(skip);

    console.log("Found routes count:", routes.length);

    // Get total count for pagination info
    const totalRoutes = await Route.countDocuments(filter);
    const totalPages = Math.ceil(totalRoutes / limitNum);

    console.log("Total routes in DB:", totalRoutes);

    res.json({
      message: "Routes retrieved successfully",
      routes: routes.map((route) => route.getSummary()),
      pagination: {
        currentPage: parseInt(page) || 1,
        totalPages,
        totalRoutes,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get user routes error:", error);
    res.status(500).json({
      message: "Error retrieving routes",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Get specific route details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid route ID format",
      });
    }

    // Find route and verify ownership
    const route = await Route.findOne({
      _id: id,
      userId: req.user._id, // Ensure user can only access their own routes
    });

    if (!route) {
      return res.status(404).json({
        message: "Route not found or access denied",
      });
    }

    // Return complete route data including coordinates for map display
    res.json({
      message: "Route retrieved successfully",
      route: {
        id: route._id,
        name: route.name,
        description: route.description,
        country: route.country,
        city: route.city,
        tripType: route.tripType,
        routeData: route.routeData,
        imageUrl: route.imageUrl,
        weatherLocation: route.weatherLocation,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get route error:", error);
    res.status(500).json({
      message: "Error retrieving route",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Delete a specific route
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid route ID format",
      });
    }

    // Find and delete route (ensure ownership)
    const deletedRoute = await Route.findOneAndDelete({
      _id: id,
      userId: req.user._id, // Ensure user can only delete their own routes
    });

    if (!deletedRoute) {
      return res.status(404).json({
        message: "Route not found or access denied",
      });
    }

    console.log(
      `Route "${deletedRoute.name}" deleted by user ${req.user.name}`
    );

    res.json({
      message: "Route deleted successfully",
      deletedRoute: {
        id: deletedRoute._id,
        name: deletedRoute.name,
      },
    });
  } catch (error) {
    console.error("Delete route error:", error);
    res.status(500).json({
      message: "Error deleting route",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

module.exports = router;
