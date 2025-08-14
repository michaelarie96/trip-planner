import { useState } from "react";
import {
  MapPin,
  Calendar,
  Route,
  Clock,
  Eye,
  Trash2,
  Bike,
  Mountain,
  MoreVertical,
  Star,
} from "lucide-react";

/**
 * RouteCard Component
 *
 * Displays a route summary card with:
 * - Route name and description
 * - Location (country/city)
 * - Trip type badge with icon
 * - Key stats (distance, duration, difficulty)
 * - Creation date
 * - Action buttons (view, delete)
 * - Responsive design with hover effects
 */
const RouteCard = ({ route, onView, onDelete }) => {
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get trip type styling
  const getTripTypeStyles = () => {
    if (route.tripType === "cycling") {
      return {
        badge: "badge-cycling",
        icon: Bike,
        borderAccent: "border-l-cycling-600",
        bgAccent: "bg-cycling-50",
      };
    } else {
      return {
        badge: "badge-trekking",
        icon: Mountain,
        borderAccent: "border-l-trekking-600",
        bgAccent: "bg-trekking-50",
      };
    }
  };

  const styles = getTripTypeStyles();
  const TripIcon = styles.icon;

  // Handle delete with confirmation
  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent card click event

    const confirmed = window.confirm(
      `Are you sure you want to delete "${route.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      setIsDeleting(true);
      try {
        await onDelete(route.id);
      } catch (error) {
        console.error("Delete failed:", error);
        setIsDeleting(false);
      }
    }
  };

  // Handle view route
  const handleView = (e) => {
    e.stopPropagation();
    onView();
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  };

  // Get location display string
  const getLocationDisplay = () => {
    if (route.city && route.country) {
      return `${route.city}, ${route.country}`;
    }
    return route.country || "Unknown location";
  };

  // Truncate text for display
  const truncateText = (text, maxLength = 80) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <div
      className={`card-hover relative overflow-hidden ${
        isDeleting ? "opacity-60 pointer-events-none" : ""
      }`}
      onClick={handleView}
    >
      {/* Trip Type Accent Border */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${styles.borderAccent}`}
      />

      {/* Card Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
              {route.name}
            </h3>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{getLocationDisplay()}</span>
            </div>
          </div>

          {/* Action Menu */}
          <div className="relative ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              title="Route actions"
            >
              <MoreVertical className="h-4 w-4 text-gray-500" />
            </button>

            {/* Actions Dropdown */}
            {showActions && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                />

                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                  <div className="py-1">
                    <button
                      onClick={handleView}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Trip Type Badge */}
        <div className="mb-3">
          <span
            className={`${styles.badge} inline-flex items-center space-x-1`}
          >
            <TripIcon className="h-3 w-3" />
            <span>
              {route.tripType.charAt(0).toUpperCase() + route.tripType.slice(1)}
            </span>
          </span>
        </div>

        {/* Description */}
        {route.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {truncateText(route.description)}
          </p>
        )}

        {/* Route Stats */}
        <div className={`${styles.bgAccent} rounded-lg p-3 mb-4`}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <Route className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">
                  {route.totalDistance || 0}km
                </p>
                <p className="text-xs text-gray-600">Distance</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">
                  {route.estimatedDuration || "Unknown"}
                </p>
                <p className="text-xs text-gray-600">Duration</p>
              </div>
            </div>
          </div>

          {/* Difficulty Badge */}
          {route.difficulty && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center space-x-1">
                <Star className="h-3 w-3 text-gray-600" />
                <span className="text-xs font-medium text-gray-700 capitalize">
                  {route.difficulty} difficulty
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>Created {formatDate(route.createdAt)}</span>
          </div>

          {/* Action Buttons - Visible on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-1">
            <button
              onClick={handleView}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              title="View route"
            >
              <Eye className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-red-100 transition-colors"
              title="Delete route"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Overlay for Delete */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-2" />
            <p className="text-sm text-gray-600">Deleting...</p>
          </div>
        </div>
      )}

      {/* Hover Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary-50 opacity-0 hover:opacity-30 transition-opacity duration-200 pointer-events-none" />
    </div>
  );
};

export default RouteCard;
