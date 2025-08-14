# 🗺️ Personal Trip Planner

> AI-powered route planning application for cycling and trekking adventures with real-time weather forecasts and interactive maps.

[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-LTS-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.18.0-green.svg)](https://mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-blue.svg)](https://tailwindcss.com/)

## ✨ Features

- 🤖 **AI-Powered Route Generation** - Generate realistic routes using Google Gemini 2.5 Pro
- 🚴 **Cycling Routes** - 2-day city-to-city routes (max 60km/day)
- 🥾 **Trekking Routes** - Circular hiking routes (5-15km)
- 🌤️ **Weather Forecasts** - 3-day forecasts from OpenWeatherMap
- 🗺️ **Interactive Maps** - Beautiful maps with Leaflet.js and enhanced markers
- 💾 **Route Management** - Save, view, and manage your routes
- 🔐 **Secure Authentication** - JWT-based auth with bcrypt password hashing
- 📱 **Responsive Design** - Mobile-friendly interface with Tailwind CSS
- 🖼️ **Country Images** - Beautiful destination photos from Unsplash

## 🛠️ Technology Stack

### Frontend
- **React 19.1.1** with Vite for fast development
- **Tailwind CSS 3.4.17** for responsive styling
- **React Leaflet 5.0.0** for interactive maps
- **Axios 1.11.0** for API communication
- **React Router DOM 7.8.0** for navigation
- **Lucide React 0.539.0** for icons

### Backend
- **Node.js** with Express.js 4.21.2 framework
- **MongoDB 6.18.0** with Mongoose 8.17.1 ODM
- **JWT 9.0.2** for authentication
- **bcrypt 6.0.0** for password security
- **Helmet 8.1.0** for security headers
- **CORS 2.8.5** for cross-origin requests

### External APIs
- **Google Gemini 2.5 Pro** - AI route generation
- **Google Places API** - Location geocoding
- **OpenWeatherMap** - Weather forecasts
- **Unsplash API** - Country images
- **OpenRouteService** - Route optimization

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (local installation or MongoDB Atlas account)
- **Git** for version control
- **API Keys** for external services (see [API Setup](#-api-setup))

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd trip-planner
```

### 2. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure your environment variables (see Environment Variables section)
# Start the server
npm run dev
```

The backend will run on `http://localhost:5001`

### 3. Frontend Setup

```bash
# Navigate to client directory (from project root)
cd client

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start the development server
npm run dev
```

The frontend will run on `http://localhost:5173`

## ⚙️ Environment Variables

### Backend (.env)
Create a `.env` file in the `server` directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/trip-planner
# or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/trip-planner

# JWT Secret (use a strong random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Google Places API
GOOGLE_GEOCODING_API_KEY=your-google-places-api-key

# Weather API
OPENWEATHER_API_KEY=your-openweather-api-key

# Images API
UNSPLASH_API_KEY=your-unsplash-api-key

# Routing API
OPENROUTESERVICE_API_KEY=your-ors-api-key

# Environment
NODE_ENV=development
PORT=5001
```

### Frontend (.env.local)
Create a `.env.local` file in the `client` directory:

```env
# API Base URL
VITE_API_URL=http://localhost:5001/api
```

## 🔑 API Setup

### Google Gemini AI
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Add to `GEMINI_API_KEY` in your `.env` file

### Google Places API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Places API
3. Create credentials
4. Add to `GOOGLE_GEOCODING_API_KEY`

### OpenWeatherMap
1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Get your free API key
3. Add to `OPENWEATHER_API_KEY`

### Unsplash API
1. Create account at [Unsplash Developers](https://unsplash.com/developers)
2. Create a new application
3. Add to `UNSPLASH_API_KEY`

### OpenRouteService
1. Register at [OpenRouteService](https://openrouteservice.org/)
2. Get API key
3. Add to `OPENROUTESERVICE_API_KEY`

## 📊 Database Setup

### Local MongoDB
```bash
# Install MongoDB locally
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb/brew/mongodb-community
```

### MongoDB Atlas (Cloud)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

## 🎯 Usage Guide

### 1. Registration & Login
- Create a new account or sign in
- JWT tokens handle secure authentication

### 2. Plan a Route
- Choose destination (country/city)
- Select trip type:
  - **Cycling**: 2-day routes, max 60km/day
  - **Trekking**: Circular routes, 5-15km
- AI generates realistic routes with actual locations

### 3. View Route Details
- Interactive map with enhanced markers
- 3-day weather forecast
- Route statistics and waypoints
- Save routes for future reference

### 4. Manage Routes
- View saved routes in history
- Filter by trip type
- Search by location
- Delete unwanted routes

## 📁 Project Structure

```
trip-planner/
├── client/                 # React frontend
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   │   ├── auth/      # Authentication components
│   │   │   ├── layout/    # Layout components
│   │   │   ├── route/     # Route-related components
│   │   │   └── weather/   # Weather components
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Page components
│   │   ├── providers/     # Context providers
│   │   ├── services/      # API services
│   │   └── index.css      # Global styles
│   ├── package.json
│   └── tailwind.config.js
├── server/                # Express backend
│   ├── config/           # Database configuration
│   ├── middleware/       # Custom middleware
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   ├── package.json
│   └── server.js         # Entry point
├── README.md
└── .gitignore
```

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Token verification

### Routes
- `POST /api/routes/generate` - Generate new route
- `POST /api/routes/save` - Save route
- `GET /api/routes/user` - Get user routes
- `GET /api/routes/:id` - Get specific route
- `DELETE /api/routes/:id` - Delete route

### Weather
- `GET /api/weather/forecast/:location` - 3-day forecast
- `GET /api/weather/route/:routeId` - Weather for saved route

### Images
- `GET /api/images/country/:country` - Get country image

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built by Michael Arie using React, Node.js, and AI**