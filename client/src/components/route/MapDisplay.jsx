import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, Flag } from "lucide-react";

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/**
 * Custom component to fit map bounds to route
 */
const FitBounds = ({ coordinates }) => {
  const map = useMap();

  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      // Create bounds from all coordinates
      const bounds = L.latLngBounds(coordinates);

      // Fit map to bounds with padding
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 13,
      });
    }
  }, [coordinates, map]);

  return null;
};

/**
 * Create enhanced custom icons for different marker types with better styling
 */
const createEnhancedIcon = (type, tripType, dayNumber = null) => {
  let iconColor, borderColor, iconSymbol, iconSize;

  // Define colors based on marker type and trip type
  switch (type) {
    case "start":
      iconColor = "#10b981"; // Green for start
      borderColor = "#059669";
      iconSymbol = "🚀";
      iconSize = [32, 32];
      break;
    case "end":
      iconColor = "#ef4444"; // Red for end
      borderColor = "#dc2626";
      iconSymbol = "🏁";
      iconSize = [32, 32];
      break;
    case "waypoint":
      // Different colors for cycling vs trekking waypoints
      if (tripType === "cycling") {
        iconColor = "#f97316"; // Orange for cycling waypoints
        borderColor = "#ea580c";
      } else {
        iconColor = "#22c55e"; // Green for trekking waypoints
        borderColor = "#16a34a";
      }
      iconSymbol = "📍";
      iconSize = [24, 24];
      break;
    case "day_start":
      // Special marker for day transitions in cycling
      iconColor = "#8b5cf6"; // Purple for day transitions
      borderColor = "#7c3aed";
      iconSymbol = dayNumber ? `${dayNumber}` : "🔄";
      iconSize = [28, 28];
      break;
    default:
      iconColor = "#6b7280";
      borderColor = "#4b5563";
      iconSymbol = "•";
      iconSize = [20, 20];
  }

  const iconAnchor = [iconSize[0] / 2, iconSize[1]];

  return L.divIcon({
    html: `
      <div style="
        background: linear-gradient(135deg, ${iconColor} 0%, ${borderColor} 100%);
        border: 3px solid white;
        border-radius: 50%;
        width: ${iconSize[0]}px;
        height: ${iconSize[1]}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
        font-size: ${type === "day_start" ? "14px" : "16px"};
        font-weight: bold;
        color: white;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        position: relative;
        transform: translateZ(0);
        transition: transform 0.2s ease;
      ">
        ${iconSymbol}
        ${
          type === "start" || type === "end"
            ? `
          <div style="
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid ${borderColor};
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
          "></div>
        `
            : ""
        }
      </div>
    `,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
    className: "enhanced-marker",
  });
};

/**
 * MapDisplay Component
 *
 * Displays interactive map with route visualization:
 * - Shows route polylines (cycling orange, trekking green)
 * - Displays start/end markers and waypoint markers
 * - Provides popups with location information
 * - Auto-fits map bounds to show entire route
 * - Responsive design with proper height
 */
const MapDisplay = ({ routeData, formData, className = "" }) => {
  const mapRef = useRef(null);

  // Debug logging for map
  console.log("=== MapDisplay Debug Info ===");
  console.log("MapDisplay received routeData:", routeData);
  console.log("MapDisplay received formData:", formData);

  // Extract route data using same logic as RouteDisplay
  let route = null;

  if (routeData?.routeData?.routeData) {
    route = routeData.routeData.routeData;
    console.log(
      "✅ MapDisplay using nested routeData.routeData.routeData structure"
    );
  } else if (routeData?.routeData) {
    route = routeData.routeData;
    console.log("✅ MapDisplay using routeData.routeData structure");
  } else if (routeData?.route) {
    route = routeData.route;
    console.log("✅ MapDisplay using routeData.route structure");
  } else {
    route = routeData;
    console.log("✅ MapDisplay using direct routeData structure");
  }

  console.log("MapDisplay extracted route:", route);
  console.log("Route coordinates:", route?.coordinates);
  console.log("Route dailyRoutes:", route?.dailyRoutes);

  // Get route styling based on trip type
  const getRouteStyles = () => {
    if (formData?.tripType === "cycling") {
      return {
        color: "#ea580c", // cycling orange
        weight: 4,
        opacity: 0.8,
        markerColor: "#ea580c",
      };
    } else {
      return {
        color: "#16a34a", // trekking green
        weight: 4,
        opacity: 0.8,
        markerColor: "#16a34a",
      };
    }
  };

  const routeStyles = getRouteStyles();

  // Default center (will be overridden by FitBounds)
  const defaultCenter = [46.2276, 2.2137]; // France
  const defaultZoom = 8;

  // If no route data, show empty state
  if (
    !routeData ||
    !route ||
    !route.coordinates ||
    route.coordinates.length === 0
  ) {
    console.log("❌ MapDisplay: No valid route data or coordinates");
    return (
      <div
        className={`map-container bg-gray-100 flex items-center justify-center ${className}`}
      >
        <div className="text-center text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Map will appear here after route generation</p>
          {route && (
            <p className="text-xs mt-1 text-gray-400">
              Route found but no coordinates available
            </p>
          )}
        </div>
      </div>
    );
  }

  const coordinates = route.coordinates;
  console.log("MapDisplay using coordinates:", coordinates.length, "points");

  /**
   * Generate enhanced markers with better categorization and styling
   */
  const generateEnhancedMarkers = (route, formData) => {
    const markers = [];
    const coordinates = route.coordinates;
    const tripType = formData?.tripType;

    // Process daily routes for enhanced markers
    if (route.dailyRoutes && route.dailyRoutes.length > 0) {
      route.dailyRoutes.forEach((day, dayIndex) => {
        const totalPoints = coordinates.length;
        const pointsPerDay = Math.floor(totalPoints / route.dailyRoutes.length);

        const startIndex = dayIndex * pointsPerDay;
        const endIndex =
          dayIndex === route.dailyRoutes.length - 1
            ? totalPoints - 1
            : (dayIndex + 1) * pointsPerDay - 1;

        const startCoord = coordinates[startIndex];
        const endCoord = coordinates[endIndex];

        // Start marker for each day
        if (startCoord) {
          const isFirstDay = dayIndex === 0;
          const markerType = isFirstDay ? "start" : "day_start";

          markers.push({
            id: `start-day-${day.day}`,
            position: startCoord,
            type: markerType,
            title: isFirstDay ? "Route Start" : `Day ${day.day} Start`,
            description: day.startPoint,
            day: day.day,
            distance: day.distance,
            dayIndex: dayIndex,
          });
        }

        // End marker for each day
        if (endCoord) {
          const isLastDay = dayIndex === route.dailyRoutes.length - 1;
          const markerType = isLastDay ? "end" : "waypoint";

          markers.push({
            id: `end-day-${day.day}`,
            position: endCoord,
            type: markerType,
            title: isLastDay ? "Route End" : `Day ${day.day} End`,
            description: day.endPoint,
            day: day.day,
            distance: day.distance,
            dayIndex: dayIndex,
          });
        }

        // Add waypoint markers for significant points
        if (day.waypoints && day.waypoints.length > 0) {
          const waypointStep = Math.max(
            1,
            Math.floor(pointsPerDay / (day.waypoints.length + 1))
          );

          day.waypoints.forEach((waypoint, wpIndex) => {
            const waypointIndex = startIndex + (wpIndex + 1) * waypointStep;
            if (waypointIndex < endIndex && coordinates[waypointIndex]) {
              markers.push({
                id: `waypoint-day-${day.day}-${wpIndex}`,
                position: coordinates[waypointIndex],
                type: "waypoint",
                title: waypoint,
                description: `Day ${day.day} waypoint`,
                day: day.day,
                waypoint: waypoint,
                dayIndex: dayIndex,
              });
            }
          });
        }
      });
    } else {
      // Fallback: use main coordinates if no daily routes
      if (coordinates.length > 0) {
        markers.push({
          id: "start",
          position: coordinates[0],
          type: "start",
          title: "Route Start",
          description: "Starting point",
        });

        if (coordinates.length > 1) {
          markers.push({
            id: "end",
            position: coordinates[coordinates.length - 1],
            type: "end",
            title: "Route End",
            description: "Ending point",
          });
        }
      }
    }

    console.log(
      `Generated ${markers.length} enhanced markers for ${tripType} route`
    );
    return markers;
  };

  const markers = generateEnhancedMarkers(route, formData);


  /**
   * Generate simple outbound/return polylines for trekking routes
   */
  const generateSimpleTrekkingPolylines = (route, formData) => {
    const polylines = [];
    const coordinates = route.coordinates;
    const tripType = formData?.tripType;

    if (!coordinates || coordinates.length < 2) return polylines;

    if (tripType === "trekking") {
      // Split route into outbound and return halves
      const midPoint = Math.floor(coordinates.length / 2);
      const outbound = coordinates.slice(0, midPoint + 1);
      const returnPath = coordinates.slice(midPoint);

      // Create outbound path (green, solid)
      if (outbound.length > 1) {
        polylines.push({
          id: "trekking-outbound",
          coordinates: outbound,
          color: "#22c55e", // Green for outbound
          weight: 5,
          opacity: 0.9,
          dashArray: null, // Solid line
          pathType: "outbound",
          metadata: {
            direction: "Outbound",
            description: "First half of the route"
          }
        });
      }

      // Create return path (blue, dashed) - no coordinate offsetting
      if (returnPath.length > 1) {
        polylines.push({
          id: "trekking-return",
          coordinates: returnPath, // Use original coordinates for road accuracy
          color: "#3b82f6", // Blue for return
          weight: 4,
          opacity: 0.8,
          dashArray: "10, 10", // Dashed line to distinguish from outbound
          pathType: "return",
          metadata: {
            direction: "Return",
            description: "Second half of the route"
          }
        });
      }

      console.log(`Generated simple trekking route: outbound (${outbound.length}) + return (${returnPath.length}) paths`);

    } else if (tripType === "cycling" && route.dailyRoutes) {
      // Keep existing cycling logic
      const totalPoints = coordinates.length;
      const pointsPerDay = Math.floor(totalPoints / route.dailyRoutes.length);

      route.dailyRoutes.forEach((day, dayIndex) => {
        const startIndex = dayIndex * pointsPerDay;
        const endIndex =
          dayIndex === route.dailyRoutes.length - 1
            ? totalPoints
            : (dayIndex + 1) * pointsPerDay;

        const dayCoordinates = coordinates.slice(startIndex, endIndex + 1);

        if (dayCoordinates.length > 1) {
          polylines.push({
            id: `cycling-day-${day.day}`,
            coordinates: dayCoordinates,
            color: dayIndex === 0 ? "#f97316" : "#dc2626",
            weight: 5,
            opacity: 0.8,
            day: day.day,
            tripType: tripType,
            metadata: {
              startPoint: day.startPoint,
              endPoint: day.endPoint,
              distance: day.distance,
            },
          });
        }
      });
    } else {
      // Fallback for simple routes
      polylines.push({
        id: "main-route",
        coordinates: coordinates,
        color: tripType === "cycling" ? "#f97316" : "#16a34a",
        weight: 4,
        opacity: 0.8,
        tripType: tripType,
      });
    }

    return polylines;
  };

  const polylines = generateSimpleTrekkingPolylines(route, formData);

  /**
   * Simple popup content for route segments
   */
  const createSegmentPopupContent = (polyline) => {
    const { day, tripType, metadata, pathType } = polyline;

    return `
    <div class="text-center min-w-[200px]">
      <h4 class="font-semibold text-gray-900 mb-2">
        ${pathType ? `${metadata?.direction} Path` : (day ? `Day ${day} Route` : "Route Segment")}
      </h4>
      <div class="space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">Type:</span>
          <span class="font-medium capitalize">${tripType}</span>
        </div>
        ${
          metadata?.description
            ? `
          <div class="text-sm text-gray-600 mt-2">
            ${metadata.description}
          </div>
        `
            : ""
        }
        ${
          metadata?.distance
            ? `
          <div class="flex justify-between">
            <span class="text-gray-600">Distance:</span>
            <span class="font-medium">${metadata.distance}km</span>
          </div>
        `
            : ""
        }
        ${
          metadata?.startPoint
            ? `
          <div class="flex justify-between">
            <span class="text-gray-600">From:</span>
            <span class="font-medium">${metadata.startPoint}</span>
          </div>
        `
            : ""
        }
        ${
          metadata?.endPoint
            ? `
          <div class="flex justify-between">
            <span class="text-gray-600">To:</span>
            <span class="font-medium">${metadata.endPoint}</span>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
  };

  /**
   * Create enhanced popup content for markers with better information
   */
  const createMarkerPopupContent = (marker, tripType) => {
    const { type, title, description, day, distance, waypoint } = marker;

    // Define icons and colors for popup headers
    const typeConfig = {
      start: { icon: "🚀", color: "text-green-700", bg: "bg-green-50" },
      end: { icon: "🏁", color: "text-red-700", bg: "bg-red-50" },
      waypoint: {
        icon: "📍",
        color: tripType === "cycling" ? "text-orange-700" : "text-green-700",
        bg: tripType === "cycling" ? "bg-orange-50" : "bg-green-50",
      },
      day_start: { icon: "🔄", color: "text-purple-700", bg: "bg-purple-50" },
    };

    const config = typeConfig[type] || typeConfig.waypoint;

    return `
    <div class="min-w-[180px]">
      <div class="${config.bg} ${config.color} px-3 py-2 rounded-t-lg border-b">
        <h4 class="font-semibold flex items-center gap-2">
          <span>${config.icon}</span>
          <span>${title}</span>
        </h4>
      </div>
      
      <div class="p-3 space-y-2">
        ${
          description
            ? `
          <div class="text-sm">
            <span class="text-gray-600">Location:</span>
            <div class="font-medium text-gray-900">${description}</div>
          </div>
        `
            : ""
        }
        
        ${
          day
            ? `
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Day:</span>
            <span class="font-medium">${day}</span>
          </div>
        `
            : ""
        }
        
        ${
          distance
            ? `
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Day Distance:</span>
            <span class="font-medium">${distance}km</span>
          </div>
        `
            : ""
        }
        
        ${
          waypoint
            ? `
          <div class="text-sm">
            <span class="text-gray-600">Waypoint:</span>
            <div class="font-medium text-gray-900">${waypoint}</div>
          </div>
        `
            : ""
        }
        
        <div class="pt-2 border-t border-gray-200">
          <div class="text-xs text-gray-500 text-center">
            ${marker.position[0].toFixed(4)}, ${marker.position[1].toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  `;
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-soft border border-gray-200 overflow-hidden ${className}`}
    >
      {/* Map Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Navigation className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            {formData?.tripType === "trekking" ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-1 bg-green-500 rounded" />
                  <span className="text-xs">outbound</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-1 border-t-2 border-dashed border-blue-500" />
                  <span className="text-xs">return</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <div
                  className="w-4 h-1 rounded"
                  style={{ backgroundColor: routeStyles.color }}
                />
                <span>{formData?.tripType || "route"}</span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              <span>📍</span>
              <span>{markers.length} markers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <MapContainer
          ref={mapRef}
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: "400px", width: "100%" }}
          zoomControl={true}
          attributionControl={true}
        >
          {/* Base Map Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Route Polylines */}
          {polylines.map((polyline) => (
            <Polyline
              key={polyline.id}
              positions={polyline.coordinates}
              pathOptions={{
                color: polyline.color,
                weight: polyline.weight,
                opacity: polyline.opacity,
                dashArray: polyline.dashArray,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Popup>
                <div
                  dangerouslySetInnerHTML={{
                    __html: createSegmentPopupContent(polyline),
                  }}
                />
              </Popup>
            </Polyline>
          ))}

          {/* Markers */}
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={marker.position}
              icon={createEnhancedIcon(
                marker.type,
                formData?.tripType,
                marker.day
              )}
            >
              <Popup>
                <div
                  dangerouslySetInnerHTML={{
                    __html: createMarkerPopupContent(
                      marker,
                      formData?.tripType
                    ),
                  }}
                />
              </Popup>
            </Marker>
          ))}


          {/* Auto-fit bounds to show entire route */}
          <FitBounds coordinates={coordinates} />
        </MapContainer>


      </div>

      {/* Map Footer with Stats */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-wrap items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>📏 {route.totalDistance || 0}km total</span>
            <span>📅 {route.estimatedDuration || "N/A"}</span>
            {route.difficulty && <span>⭐ {route.difficulty} difficulty</span>}
          </div>
          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            <Flag className="h-4 w-4" />
            <span>{polylines.length} route segments</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapDisplay;
