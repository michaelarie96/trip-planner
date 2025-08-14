import { useState, useEffect, useCallback } from "react";
import Layout from "../components/layout/Layout";
import RouteCard from "../components/route/RouteCard";
import RouteDetailModal from "../components/route/RouteDetailModal";
import {
  History,
  Map,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  MapPin,
} from "lucide-react";
import { routesAPI } from "../services/api";
import { Link } from "react-router-dom";

/**
 * HistoryPage Component
 *
 * Displays user's saved routes with:
 * - Route cards showing key information
 * - Filter by trip type
 * - Sort by date/distance
 * - Search by name/location
 * - Route detail modal with map and weather
 * - Delete functionality
 * - Pagination support
 */
const HistoryPage = () => {
  // Route data state
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRoutes: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Filter and sort state
  const [filters, setFilters] = useState({
    tripType: "", // '', 'cycling', 'trekking'
    sortBy: "date", // 'date', 'distance', 'name'
    sortOrder: "desc", // 'asc', 'desc'
    search: "",
  });

  // Modal state for viewing route details
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch routes from API
  const fetchRoutes = useCallback(async (page = 1, resetFilters = false) => {
    setIsLoading(true);
    setError("");

    try {
      console.log("Fetching routes...", { page, filters });

      // Build query parameters
      const params = {
        page: page,
        limit: 12, // Show 12 routes per page
      };

      // Add trip type filter if selected
      if (filters.tripType && !resetFilters) {
        params.tripType = filters.tripType;
      }

      // Call API
      const response = await routesAPI.getUserRoutes(params);

      if (response.data && response.data.routes) {
        console.log("Routes fetched:", response.data.routes.length);
        
        let fetchedRoutes = response.data.routes;

        // Apply client-side filtering and sorting (since API has limited filtering)
        if (!resetFilters) {
          // Search filter
          if (filters.search.trim()) {
            const searchTerm = filters.search.toLowerCase();
            fetchedRoutes = fetchedRoutes.filter(
              (route) =>
                route.name.toLowerCase().includes(searchTerm) ||
                route.country.toLowerCase().includes(searchTerm) ||
                (route.city && route.city.toLowerCase().includes(searchTerm))
            );
          }

          // Sorting
          fetchedRoutes.sort((a, b) => {
            let aValue, bValue;

            switch (filters.sortBy) {
              case "distance":
                aValue = a.totalDistance || 0;
                bValue = b.totalDistance || 0;
                break;
              case "name":
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                console.log(`Sorting: "${aValue}" vs "${bValue}" (${filters.sortOrder})`);
                break;
              case "date":
              default:
                aValue = new Date(a.createdAt);
                bValue = new Date(b.createdAt);
                break;
            }

            if (filters.sortOrder === "asc") {
              if (filters.sortBy === "name") {
                return aValue.localeCompare(bValue);
              }
              return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
              if (filters.sortBy === "name") {
                return bValue.localeCompare(aValue);
              }
              return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
          });
        }

        setRoutes(fetchedRoutes);
        setPagination(response.data.pagination);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to load routes";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [filters]); // Add filters as dependency

  // Fetch routes on component mount and when filters change
  useEffect(() => {
    fetchRoutes(1);
  }, [filters, fetchRoutes]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        [key]: value,
      };
      
      // When changing to name sorting, default to ascending (A-Z)
      if (key === "sortBy" && value === "name" && prev.sortBy !== "name") {
        newFilters.sortOrder = "asc";
      }
      // When changing to date sorting, default to descending (newest first)
      else if (key === "sortBy" && value === "date" && prev.sortBy !== "date") {
        newFilters.sortOrder = "desc";
      }
      
      return newFilters;
    });
  };

  // Handle search input with debouncing
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      search: value,
    }));
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchRoutes(newPage);
    }
  };

  // Handle route deletion
  const handleDeleteRoute = async (routeId) => {
    try {
      console.log("Deleting route:", routeId);
      await routesAPI.deleteRoute(routeId);
      
      // Remove from local state
      setRoutes((prev) => prev.filter((route) => route.id !== routeId));
      
      // Update pagination count
      setPagination((prev) => ({
        ...prev,
        totalRoutes: prev.totalRoutes - 1,
      }));

      console.log("Route deleted successfully");
    } catch (error) {
      console.error("Error deleting route:", error);
      // Show error to user (could implement toast notification)
      alert("Failed to delete route. Please try again.");
    }
  };

  // Handle viewing route details
  const handleViewRoute = async (route) => {
    try {
      console.log("Loading route details:", route.id);
      
      // Fetch full route details
      const response = await routesAPI.getRoute(route.id);
      
      if (response.data && response.data.route) {
        setSelectedRoute(response.data.route);
        setShowDetailModal(true);
      } else {
        throw new Error("Failed to load route details");
      }
    } catch (error) {
      console.error("Error loading route details:", error);
      alert("Failed to load route details. Please try again.");
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    fetchRoutes(pagination.currentPage);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      tripType: "",
      sortBy: "date",
      sortOrder: "desc",
      search: "",
    });
    fetchRoutes(1, true);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-2 flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <History className="h-6 w-6 text-primary-600" />
                </div>
                <span>My Saved Routes</span>
              </h1>
              <p className="text-gray-600">
                View, manage, and get current weather for your saved adventure routes.
              </p>
            </div>

            {/* Add New Route Button */}
            <Link
              to="/plan"
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Plan New Route</span>
            </Link>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-soft border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Search Routes
              </label>
              <input
                id="search"
                type="text"
                value={filters.search}
                onChange={handleSearchChange}
                className="input-base"
                placeholder="Search by name, country, or city..."
              />
            </div>

            {/* Trip Type Filter */}
            <div>
              <label htmlFor="tripType" className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="h-4 w-4 inline mr-1" />
                Trip Type
              </label>
              <select
                id="tripType"
                value={filters.tripType}
                onChange={(e) => handleFilterChange("tripType", e.target.value)}
                className="input-base"
              >
                <option value="">All Types</option>
                <option value="cycling">Cycling</option>
                <option value="trekking">Trekking</option>
              </select>
            </div>

            {/* Sort Options */}
            <div>
              <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-2">
                {filters.sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4 inline mr-1" />
                ) : (
                  <SortDesc className="h-4 w-4 inline mr-1" />
                )}
                Sort By
              </label>
              <div className="flex space-x-1">
                <select
                  id="sortBy"
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                  className="input-base"
                >
                  <option value="date">Date Created</option>
                  <option value="name">Name</option>
                  <option value="distance">Distance</option>
                </select>
                <button
                  onClick={() =>
                    handleFilterChange(
                      "sortOrder",
                      filters.sortOrder === "asc" ? "desc" : "asc"
                    )
                  }
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title={`Sort ${filters.sortOrder === "asc" ? "descending" : "ascending"}`}
                >
                  {filters.sortOrder === "asc" ? (
                    <SortAsc className="h-4 w-4 text-gray-600" />
                  ) : (
                    <SortDesc className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>
                {pagination.totalRoutes} route{pagination.totalRoutes !== 1 ? "s" : ""} found
              </span>
              {(filters.search || filters.tripType) && (
                <button
                  onClick={handleResetFilters}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your routes...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Failed to Load Routes
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button onClick={handleRefresh} className="btn-primary">
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && routes.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filters.search || filters.tripType ? "No Routes Found" : "No Saved Routes Yet"}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {filters.search || filters.tripType
                ? "Try adjusting your search criteria or filters to find routes."
                : "Start planning your first adventure! Create personalized routes and save them for future trips."}
            </p>
            {filters.search || filters.tripType ? (
              <button onClick={handleResetFilters} className="btn-secondary mr-3">
                Clear Filters
              </button>
            ) : null}
            <Link to="/plan" className="btn-primary">
              {filters.search || filters.tripType ? "Plan a Route" : "Plan Your First Route"}
            </Link>
          </div>
        )}

        {/* Routes Grid */}
        {!isLoading && !error && routes.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onView={() => handleViewRoute(route)}
                  onDelete={() => handleDeleteRoute(route.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show pages around current page
                      const current = pagination.currentPage;
                      return (
                        page === 1 ||
                        page === pagination.totalPages ||
                        (page >= current - 1 && page <= current + 1)
                      );
                    })
                    .map((page, index, array) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            page === pagination.currentPage
                              ? "bg-primary-600 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    ))}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Route Detail Modal */}
        {showDetailModal && selectedRoute && (
          <RouteDetailModal
            route={selectedRoute}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedRoute(null);
            }}
            onDelete={(routeId) => {
              handleDeleteRoute(routeId);
              setShowDetailModal(false);
              setSelectedRoute(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
};

export default HistoryPage;