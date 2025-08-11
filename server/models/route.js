const mongoose = require("mongoose");

// Define Route schema for storing trip routes
const routeSchema = new mongoose.Schema(
  {
    // Basic route information
    name: {
      type: String,
      required: [true, "Route name is required"],
      trim: true,
      minlength: [2, "Route name must be at least 2 characters"],
      maxlength: [100, "Route name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Route description is required"],
      trim: true,
      minlength: [5, "Description must be at least 5 characters"],
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    
    // User association - references User model
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    
    // Location information
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    
    // Trip type - cycling or trekking
    tripType: {
      type: String,
      required: [true, "Trip type is required"],
      enum: {
        values: ["cycling", "trekking"],
        message: "Trip type must be either cycling or trekking",
      },
    },
    
    // Route data from LLM generation
    routeData: {
      // Array of coordinate pairs [latitude, longitude]
      coordinates: {
        type: [[Number]], // Array of [lat, lng] pairs
        required: [true, "Route coordinates are required"],
        validate: {
          validator: function(coordinates) {
            // Ensure we have at least 2 points for a route
            return coordinates && coordinates.length >= 2;
          },
          message: "Route must have at least 2 coordinate points",
        },
      },
      
      // Waypoints/landmarks along the route
      waypoints: {
        type: [String],
        default: [],
      },
      
      // Daily route breakdown
      dailyRoutes: [
        {
          day: {
            type: Number,
            required: true,
          },
          startPoint: {
            type: String,
            required: true,
          },
          endPoint: {
            type: String,
            required: true,
          },
          distance: {
            type: Number, // Distance in kilometers
            required: true,
            min: [0, "Distance cannot be negative"],
          },
          coordinates: {
            type: [[Number]], // Coordinates for this specific day
            required: true,
          },
          waypoints: {
            type: [String],
            default: [],
          },
        },
      ],
      
      // Total route statistics
      totalDistance: {
        type: Number,
        required: [true, "Total distance is required"],
        min: [0, "Total distance cannot be negative"],
      },
      
      estimatedDuration: {
        type: String, // e.g., "2 days", "1 day"
        required: [true, "Estimated duration is required"],
      },
      
      // Difficulty level (optional, can be added by LLM)
      difficulty: {
        type: String,
        enum: ["easy", "moderate", "hard"],
        default: "moderate",
      },
    },
    
    // Image URL from Unsplash API
    imageUrl: {
      type: String,
      validate: {
        validator: function(url) {
          if (!url) return true; // Allow empty URLs
          // Basic URL validation
          return /^https?:\/\/.+/.test(url);
        },
        message: "Image URL must be a valid HTTP/HTTPS URL",
      },
    },
    
    // LLM generation metadata (for debugging and improvement)
    generationData: {
      llmModel: {
        type: String, // e.g., "huggingface/model-name"
      },
      prompt: {
        type: String, // The prompt sent to LLM
      },
      generatedAt: {
        type: Date,
        default: Date.now,
      },
      processingTime: {
        type: Number, // Time taken to generate in milliseconds
      },
    },
    
    // Weather data is NOT stored (fetched real-time as per requirements)
    // But we store the starting location for weather fetching
    weatherLocation: {
      coordinates: {
        type: [Number], // [latitude, longitude] for weather API
        required: false, // Can be calculated from route coordinates
        validate: {
          validator: function(coords) {
            if (!coords || coords.length === 0) return true; // Allow empty
            return coords.length === 2 && 
                   coords[0] >= -90 && coords[0] <= 90 && // latitude
                   coords[1] >= -180 && coords[1] <= 180; // longitude
          },
          message: "Weather coordinates must be [latitude, longitude] within valid ranges",
        },
      },
      locationName: {
        type: String, // Human-readable location name for weather
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for better query performance
routeSchema.index({ userId: 1, createdAt: -1 }); // User routes by creation date
routeSchema.index({ country: 1, tripType: 1 }); // Routes by country and type
routeSchema.index({ "routeData.totalDistance": 1 }); // Routes by distance

// Instance method to get route summary
routeSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    country: this.country,
    city: this.city,
    tripType: this.tripType,
    totalDistance: this.routeData.totalDistance,
    estimatedDuration: this.routeData.estimatedDuration,
    difficulty: this.routeData.difficulty,
    createdAt: this.createdAt,
  };
};

// Instance method to get coordinates for map display
routeSchema.methods.getMapData = function() {
  return {
    coordinates: this.routeData.coordinates,
    waypoints: this.routeData.waypoints,
    dailyRoutes: this.routeData.dailyRoutes.map(day => ({
      day: day.day,
      startPoint: day.startPoint,
      endPoint: day.endPoint,
      coordinates: day.coordinates,
      distance: day.distance,
    })),
  };
};

// Static method to find routes by user
routeSchema.statics.findByUser = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "name email");
};

// Static method to find routes by criteria
routeSchema.statics.findByCriteria = function(criteria) {
  const query = {};
  
  if (criteria.country) query.country = new RegExp(criteria.country, "i");
  if (criteria.tripType) query.tripType = criteria.tripType;
  if (criteria.minDistance) query["routeData.totalDistance"] = { $gte: criteria.minDistance };
  if (criteria.maxDistance) {
    query["routeData.totalDistance"] = query["routeData.totalDistance"] || {};
    query["routeData.totalDistance"].$lte = criteria.maxDistance;
  }
  
  return this.find(query).populate("userId", "name email");
};

// Pre-save middleware to calculate total distance and weather location if not provided
routeSchema.pre("save", function(next) {
  // Calculate total distance if it's 0 or not set and we have daily routes
  if ((!this.routeData.totalDistance || this.routeData.totalDistance === 0) && 
      this.routeData.dailyRoutes && this.routeData.dailyRoutes.length > 0) {
    this.routeData.totalDistance = this.routeData.dailyRoutes.reduce(
      (total, day) => total + (day.distance || 0),
      0
    );
  }
  
  // Set weather location from first coordinate if not provided
  if ((!this.weatherLocation || !this.weatherLocation.coordinates || this.weatherLocation.coordinates.length === 0) &&
      this.routeData.coordinates && this.routeData.coordinates.length > 0) {
    // Initialize weatherLocation if it doesn't exist
    if (!this.weatherLocation) {
      this.weatherLocation = {};
    }
    this.weatherLocation.coordinates = this.routeData.coordinates[0];
    if (!this.weatherLocation.locationName && (this.city || this.country)) {
      this.weatherLocation.locationName = this.city ? `${this.city}, ${this.country}` : this.country;
    }
  }
  
  next();
});

const Route = mongoose.model("Route", routeSchema);

module.exports = Route;