import React from 'react';
import MapDisplay from './MapDisplay';

/**
 * Test component for map visualization improvements
 * Shows different scenarios for trekking route visualization
 */
const MapVisualizationTest = () => {
  // Mock trekking route data with circular pattern
  const mockTrekkingRoute = {
    routeData: {
      coordinates: [
        // Circular route starting and ending at same point
        [46.2276, 2.2137], // Start
        [46.2376, 2.2237], // North
        [46.2476, 2.2237], // Northeast  
        [46.2476, 2.2137], // East
        [46.2476, 2.2037], // Southeast
        [46.2376, 2.2037], // South
        [46.2276, 2.2037], // Southwest
        [46.2176, 2.2137], // West
        [46.2176, 2.2237], // Northwest
        [46.2276, 2.2137], // Back to start - circular
        // Some overlapping return path
        [46.2176, 2.2137], // Overlap
        [46.2276, 2.2037], // Overlap
        [46.2276, 2.2137], // Final return to start
      ],
      totalDistance: 12,
      estimatedDuration: "4 hours",
      difficulty: "moderate",
      dailyRoutes: [
        {
          day: 1,
          startPoint: "Village Center",
          endPoint: "Village Center",
          distance: 12,
          waypoints: ["Forest Trail", "Mountain View", "Lake Shore", "Historic Bridge"]
        }
      ]
    }
  };

  const mockFormData = {
    tripType: "trekking",
    country: "France"
  };

  // Mock cycling route for comparison
  const mockCyclingRoute = {
    routeData: {
      coordinates: [
        [46.2276, 2.2137],
        [46.2376, 2.2237],
        [46.2476, 2.2337],
        [46.2576, 2.2437],
        [46.2676, 2.2537],
      ],
      totalDistance: 45,
      estimatedDuration: "2 days", 
      difficulty: "moderate",
      dailyRoutes: [
        {
          day: 1,
          startPoint: "City A",
          endPoint: "City B",
          distance: 25,
          waypoints: ["Village 1", "Rest Stop"]
        },
        {
          day: 2,
          startPoint: "City B", 
          endPoint: "City C",
          distance: 20,
          waypoints: ["Village 2"]
        }
      ]
    }
  };

  const mockCyclingFormData = {
    tripType: "cycling",
    country: "France"
  };

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Map Visualization Test
        </h1>
        <p className="text-gray-600 mb-8">
          Testing simple outbound/return visualization for circular trekking routes vs linear cycling routes
        </p>

        {/* Trekking Route Test */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🥾 Circular Trekking Route - Simple Outbound/Return
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Should show: Green solid line for outbound path, Blue dashed line for return path.
            Lines follow actual roads/paths accurately.
          </p>
          <MapDisplay 
            routeData={mockTrekkingRoute}
            formData={mockFormData}
            className="h-96"
          />
        </div>

        {/* Cycling Route Test */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🚴 Linear Cycling Route - Day-based Colors  
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Should show: Orange (Day 1) → Red (Day 2) with standard markers.
          </p>
          <MapDisplay 
            routeData={mockCyclingRoute}
            formData={mockCyclingFormData}
            className="h-96"
          />
        </div>

        {/* Feature Explanation */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            🎯 Visualization Features
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">For Trekking Routes:</h4>
              <ul className="space-y-1 text-blue-700">
                <li>• Green solid line for outbound journey</li>
                <li>• Blue dashed line for return journey</li>
                <li>• Lines follow actual roads/paths accurately</li>
                <li>• Different styles distinguish overlapping sections</li>
                <li>• Legend shows path types</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-2">For Cycling Routes:</h4>
              <ul className="space-y-1 text-blue-700">
                <li>• Different colors for each day</li>
                <li>• Day transition markers</li>
                <li>• Standard directional arrows</li>
                <li>• Route segment popups</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapVisualizationTest;