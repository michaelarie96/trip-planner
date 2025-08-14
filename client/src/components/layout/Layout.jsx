import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  Menu,
  X,
  Map,
  History,
  User,
  LogOut,
  ChevronDown,
  Home,
} from "lucide-react";

/**
 * Layout Component
 *
 * Provides consistent navigation header and layout structure
 * Handles authenticated and non-authenticated states
 * Responsive design with mobile menu
 */
const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // User dropdown state
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Handle logout
  const handleLogout = () => {
    console.log("Logout clicked");
    logout();
    navigate("/", { replace: true });
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  // Check if current route is active
  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  // Navigation links for authenticated users
  const authenticatedNavLinks = [
    {
      name: "Plan Route",
      path: "/plan",
      icon: Map,
      description: "Create new trip routes",
    },
    {
      name: "My Routes",
      path: "/history",
      icon: History,
      description: "View saved routes",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Map className="h-5 w-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-semibold text-gray-900">
                    Trip Planner
                  </h1>
                  <p className="text-xs text-gray-500 -mt-1">
                    AI-Powered Routes
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {/* Public Navigation */}
              <Link
                to="/"
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActiveRoute("/")
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>

              {/* Authenticated Navigation */}
              {isAuthenticated && (
                <>
                  {authenticatedNavLinks.map((link) => {
                    const IconComponent = link.icon;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActiveRoute(link.path)
                            ? "text-primary-600 bg-primary-50"
                            : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                        }`}
                        title={link.description}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span>{link.name}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>

            {/* User Menu / Auth Buttons */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                /* Authenticated User Menu */
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-600" />
                    </div>
                    <span className="hidden sm:block">
                      {user?.name || "User"}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserMenuOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsUserMenuOpen(false)}
                      />

                      {/* Dropdown */}
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                        <div className="py-1">
                          {/* User Info */}
                          <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-900">
                              {user?.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {user?.email}
                            </p>
                          </div>

                          {/* Logout Button */}
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Non-authenticated Auth Buttons */
                <div className="flex items-center space-x-3">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Get Started
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-3">
              {/* Public Links */}
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActiveRoute("/")
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                }`}
              >
                <Home className="h-5 w-5" />
                <span>Home</span>
              </Link>

              {/* Authenticated Links */}
              {isAuthenticated && (
                <>
                  {authenticatedNavLinks.map((link) => {
                    const IconComponent = link.icon;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                          isActiveRoute(link.path)
                            ? "text-primary-600 bg-primary-50"
                            : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                        <div>
                          <div>{link.name}</div>
                          <div className="text-xs text-gray-500">
                            {link.description}
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {/* Mobile User Info & Logout */}
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.name}
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center space-x-2 px-3 py-2 text-base font-medium text-gray-600 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="h-5 w-5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}

              {/* Non-authenticated Mobile Auth */}
              {!isAuthenticated && (
                <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-center px-3 py-2 text-base font-medium text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-center btn-primary text-base"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-sm text-gray-500">
              © 2025 Personal Trip Planner. Built by Michael Arie with React,
              Node.js, and AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
