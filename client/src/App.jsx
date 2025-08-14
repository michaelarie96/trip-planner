import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";
import { AuthProvider } from "./providers/AuthProvider";
import ProtectedRoute, { PublicRoute } from "./components/auth/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import { Map, History } from "lucide-react";

// Import pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import PlanningPage from "./pages/PlanningPage";
import HistoryPage from "./pages/HistoryPage";

// Import the Layout component
import Layout from "./components/layout/Layout";

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();

  // If user is authenticated, show a simple dashboard/welcome page
  if (isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-gray-900 mb-4">
              Welcome back, {user?.name}! 👋
            </h1>
            <p className="text-gray-600 mb-8">
              Ready to plan your next adventure?
            </p>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Link
                to="/plan"
                className="bg-white p-6 rounded-xl shadow-soft border border-gray-200 hover:shadow-card-hover hover:border-primary-300 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-200 transition-colors">
                  <Map className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Plan New Route
                </h3>
                <p className="text-gray-600 text-sm">
                  Create a new cycling or trekking route with AI assistance
                </p>
              </Link>

              <Link
                to="/history"
                className="bg-white p-6 rounded-xl shadow-soft border border-gray-200 hover:shadow-card-hover hover:border-primary-300 transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-200 transition-colors">
                  <History className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  My Routes
                </h3>
                <p className="text-gray-600 text-sm">
                  View and manage your saved routes
                </p>
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // For non-authenticated users, show the landing page
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Personal Trip Planner
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Plan personalized cycling and trekking routes with AI assistance,
          weather forecasts, and beautiful maps.
        </p>
        <div className="space-x-4">
          <Link to="/login" className="btn-secondary">
            Sign In
          </Link>
          <Link to="/register" className="btn-primary">
            Get Started
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-lg shadow-soft border border-gray-200">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-primary-600 text-xl font-bold">🚴</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              AI-Powered Routes
            </h3>
            <p className="text-gray-600 text-sm">
              Generate realistic cycling and trekking routes using advanced AI
              models tailored to your preferences.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-soft border border-gray-200">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-primary-600 text-xl font-bold">🌤️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Weather Forecasts
            </h3>
            <p className="text-gray-600 text-sm">
              Get 3-day weather forecasts for your route locations to plan your
              adventures perfectly.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-soft border border-gray-200">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-primary-600 text-xl font-bold">🗺️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Interactive Maps
            </h3>
            <p className="text-gray-600 text-sm">
              Visualize your routes on beautiful interactive maps with waypoints
              and detailed information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main App Component
 *
 * Sets up the entire application with:
 * - React Router for navigation
 * - AuthProvider for global authentication state
 * - Route protection for authenticated/public routes
 * - Route definitions for all pages
 */
function App() {
  console.log("App component rendering...");

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes - accessible without authentication */}
            {/* Home page - anyone can access */}
            <Route path="/" element={<HomePage />} />

            {/* Auth routes - redirect if already authenticated */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />

            {/* Protected Routes - require authentication */}
            <Route
              path="/plan"
              element={
                <ProtectedRoute>
                  <PlanningPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
