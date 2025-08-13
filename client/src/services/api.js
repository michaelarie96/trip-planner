import axios from "axios";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  timeout: 15000, // 15 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("authToken");
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("API Response Error:", error.response?.status, error.response?.data);
    
    // Handle common error scenarios
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      
      // Only redirect if we're not already on login page
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    
    if (error.response?.status === 403) {
      console.error("Access forbidden");
    }
    
    if (error.response?.status >= 500) {
      console.error("Server error - please try again later");
    }
    
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  register: (userData) => api.post("/auth/register", userData),
  login: (credentials) => api.post("/auth/login", credentials),
  verify: () => api.get("/auth/verify"),
};

// Routes API endpoints
export const routesAPI = {
  generate: (routeData) => api.post("/routes/generate", routeData),
  save: (routeData) => api.post("/routes/save", routeData),
  getUserRoutes: (params = {}) => api.get("/routes/user", { params }),
  getRoute: (id) => api.get(`/routes/${id}`),
  deleteRoute: (id) => api.delete(`/routes/${id}`),
};

// Weather API endpoints
export const weatherAPI = {
  getForecast: (location) => api.get(`/weather/forecast/${encodeURIComponent(location)}`),
  getCurrent: (location) => api.get(`/weather/current/${encodeURIComponent(location)}`),
  getRouteWeather: (routeId) => api.get(`/weather/route/${routeId}`),
};

// Images API endpoints
export const imagesAPI = {
  getCountryImage: (country, city = null) => {
    const params = city ? { city } : {};
    return api.get(`/images/country/${encodeURIComponent(country)}`, { params });
  },
  getStatus: () => api.get("/images/status"),
};

// Generic API function for custom requests
export const apiRequest = async (method, endpoint, data = null, config = {}) => {
  const response = await api({
    method,
    url: endpoint,
    data,
    ...config,
  });
  return response.data;
};

// Export the configured axios instance as default
export default api;