import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, Flag } from "lucide-react";

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
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
 * Create custom icons for different marker types
 */
const createCustomIcon = (type, color) => {
  const iconSize = type === 'waypoint' ? [25, 25] : [35, 35];
  const iconAnchor = type === 'waypoint' ? [12, 12] : [17, 35];
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        width: ${iconSize[0]}px;
        height: ${iconSize[1]}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        font-size: ${type === 'waypoint' ? '12px' : '16px'};
        color: white;
        font-weight: bold;
      ">
        ${type === 'start' ? '🏁' : type === 'end' ? '🏁' : type === 'waypoint' ? '📍' : '•'}
      </div>
    `,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
    className: 'custom-marker',
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

  // Get route styling based on trip type
  const getRouteStyles = () => {
    if (formData.tripType === "cycling") {
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
  if (!routeData || !routeData.routeData || !routeData.routeData.coordinates) {
    return (
      <div className={`map-container bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Map will appear here after route generation</p>
        </div>
      </div>
    );
  }

  const route = routeData.routeData;
  const coordinates = route.coordinates;

  // Generate markers for start, end, and waypoints
  const generateMarkers = () => {
    const markers = [];

    // Process daily routes for markers
    if (route.dailyRoutes && route.dailyRoutes.length > 0) {
      route.dailyRoutes.forEach((day, dayIndex) => {
        // Start marker for each day
        if (day.coordinates && day.coordinates.length > 0) {
          const startCoord = day.coordinates[0];
          markers.push({
            id: `start-day-${day.day}`,
            position: startCoord,
            type: dayIndex === 0 ? 'start' : 'waypoint',
            title: `Day ${day.day} Start`,
            description: day.startPoint,
            day: day.day,
          });

          // End marker for each day
          const endCoord = day.coordinates[day.coordinates.length - 1];
          markers.push({
            id: `end-day-${day.day}`,
            position: endCoord,
            type: dayIndex === route.dailyRoutes.length - 1 ? 'end' : 'waypoint',
            title: `Day ${day.day} End`,
            description: day.endPoint,
            day: day.day,
          });
        }
      });
    } else {
      // Fallback: use main coordinates if no daily routes
      if (coordinates.length > 0) {
        markers.push({
          id: 'start',
          position: coordinates[0],
          type: 'start',
          title: 'Route Start',
          description: 'Starting point',
        });

        if (coordinates.length > 1) {
          markers.push({
            id: 'end',
            position: coordinates[coordinates.length - 1],
            type: 'end',
            title: 'Route End',
            description: 'Ending point',
          });
        }
      }
    }

    return markers;
  };

  const markers = generateMarkers();

  // Generate polylines for daily routes
  const generatePolylines = () => {
    const polylines = [];

    if (route.dailyRoutes && route.dailyRoutes.length > 0) {
      route.dailyRoutes.forEach((day) => {
        if (day.coordinates && day.coordinates.length > 1) {
          polylines.push({
            id: `day-${day.day}`,
            coordinates: day.coordinates,
            color: routeStyles.color,
            weight: routeStyles.weight,
            opacity: routeStyles.opacity,
            day: day.day,
          });
        }
      });
    } else {
      // Fallback: use main coordinates
      if (coordinates.length > 1) {
        polylines.push({
          id: 'main-route',
          coordinates: coordinates,
          color: routeStyles.color,
          weight: routeStyles.weight,
          opacity: routeStyles.opacity,
        });
      }
    }

    return polylines;
  };

  const polylines = generatePolylines();

  return (
    <div className={`bg-white rounded-xl shadow-soft border border-gray-200 overflow-hidden ${className}`}>
      {/* Map Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Navigation className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <div
                className="w-4 h-1 rounded"
                style={{ backgroundColor: routeStyles.color }}
              />
              <span>{formData.tripType} route</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>📍</span>
              <span>waypoints</span>
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
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
              <Popup>
                <div className="text-center">
                  <h4 className="font-medium text-gray-900 mb-1">
                    {polyline.day ? `Day ${polyline.day} Route` : 'Route'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {formData.tripType.charAt(0).toUpperCase() + formData.tripType.slice(1)} route
                  </p>
                </div>
              </Popup>
            </Polyline>
          ))}

          {/* Markers */}
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={marker.position}
              icon={createCustomIcon(marker.type, routeStyles.markerColor)}
            >
              <Popup>
                <div className="text-center min-w-[150px]">
                  <h4 className="font-medium text-gray-900 mb-1">
                    {marker.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {marker.description}
                  </p>
                  {marker.day && (
                    <div className="text-xs text-gray-500">
                      Day {marker.day}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {marker.position[0].toFixed(4)}, {marker.position[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Auto-fit bounds to show entire route */}
          <FitBounds coordinates={coordinates} />
        </MapContainer>

        {/* Map Loading Overlay (if needed) */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2 text-sm text-gray-600">
          {coordinates.length} route points
        </div>
      </div>

      {/* Map Footer with Stats */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-wrap items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>📏 {route.totalDistance}km total</span>
            <span>📅 {route.estimatedDuration}</span>
            {route.difficulty && (
              <span>⭐ {route.difficulty} difficulty</span>
            )}
          </div>
          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            <Flag className="h-4 w-4" />
            <span>{markers.length} waypoints</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapDisplay;