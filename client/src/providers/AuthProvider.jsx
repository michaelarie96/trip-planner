import { useState, useEffect } from "react";
import { AuthContext } from "../contexts/authContext";
import { authAPI } from "../services/api";

export const AuthProvider = ({ children }) => {
  // Authentication state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false); // New state to track initialization

  // Initialize auth state on app startup
  useEffect(() => {
    const initializeAuth = async () => {
      console.log("Initializing authentication...");

      // Add a minimum loading time for better UX (prevents flash on fast connections)
      const minLoadTime = new Promise((resolve) => setTimeout(resolve, 800));

      try {
        const storedToken = localStorage.getItem("authToken");
        const storedUser = localStorage.getItem("user");

        if (storedToken && storedUser) {
          console.log("Found stored token, verifying...");
          setToken(storedToken);

          const response = await authAPI.verify();

          if (response.data && response.data.user) {
            console.log("Token verified successfully");
            setUser(response.data.user);
            setIsAuthenticated(true);
          } else {
            console.log("Token verification failed");
            clearAuthData();
          }
        } else {
          console.log("No stored authentication found");
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        clearAuthData();
      }

      // Wait for minimum load time to complete
      await minLoadTime;

      // Mark auth as initialized and stop loading
      setAuthInitialized(true);
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const clearAuthData = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
  };

  const setAuthData = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem("authToken", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const login = async (email, password) => {
    try {
      console.log("Attempting login...");

      const response = await authAPI.login({ email, password });

      if (response.data && response.data.token && response.data.user) {
        console.log("Login successful");
        setAuthData(response.data.user, response.data.token);
        return { success: true, message: "Login successful" };
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Login error:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Login failed. Please try again.";

      return { success: false, message: errorMessage };
    }
  };

  const register = async (name, email, password) => {
    try {
      console.log("Attempting registration...");

      const response = await authAPI.register({ name, email, password });

      if (response.data && response.data.token && response.data.user) {
        console.log("Registration successful");
        setAuthData(response.data.user, response.data.token);
        return { success: true, message: "Registration successful" };
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Registration error:", error);

      let errorMessage;
      if (
        error.response?.data?.errors &&
        Array.isArray(error.response.data.errors)
      ) {
        errorMessage = error.response.data.errors.join(", ");
      } else {
        errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Registration failed. Please try again.";
      }

      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    console.log("Logging out...");
    clearAuthData();
    return { success: true, message: "Logged out successfully" };
  };

  const updateUser = (updatedUserData) => {
    const newUserData = { ...user, ...updatedUserData };
    setUser(newUserData);
    localStorage.setItem("user", JSON.stringify(newUserData));
  };

  const contextValue = {
    user,
    token,
    isLoading,
    isAuthenticated,
    authInitialized,
    login,
    register,
    logout,
    updateUser,
    clearAuthData,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
