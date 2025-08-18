import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * ProtectedRoute Component
 *
 * Wraps components that require authentication
 * Redirects to login if user is not authenticated
 * Shows loading state while checking authentication
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <div className="text-center">
            <h2 className="text-lg font-medium text-gray-900">Loading...</h2>
            <p className="text-sm text-gray-600 mt-1">
              Checking authentication status
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is NOT authenticated, redirect to login
  if (!isAuthenticated) {
    console.log("User not authenticated, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the protected component
  console.log("User authenticated, rendering protected route");
  return children;
};

/**
 * PublicRoute Component
 *
 * Wraps components that should only be accessible to non-authenticated users
 * Redirects authenticated users to the main app
 */
export const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <div className="text-center">
            <h2 className="text-lg font-medium text-gray-900">Loading...</h2>
            <p className="text-sm text-gray-600 mt-1">
              Checking authentication status
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is authenticated, redirect to intended destination or default route
  if (isAuthenticated) {
    // Check if there was an intended destination stored in location state
    const from = location.state?.from?.pathname || "/";
    console.log("User already authenticated, redirecting to:", from);

    return <Navigate to={from} replace />;
  }

  // User is not authenticated, render the public component (login/register)
  console.log("User not authenticated, rendering public route");
  return children;
};

export default ProtectedRoute;
