// @ts-nocheck
const nock = require('nock');

// Mock environment variables first
process.env.GEMINI_API_KEY = 'test-gemini-api-key';

// Mock the Google GenAI SDK
const mockGenerateContent = jest.fn();
const mockGenAI = {
  models: {
    generateContent: mockGenerateContent
  }
};

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn(() => mockGenAI)
  };
});

// Mock other external services
jest.mock('../../services/imageService', () => ({
  getImage: jest.fn().mockResolvedValue({
    imageUrl: 'https://test-image.jpg',
    photographer: { name: 'Test Photographer' }
  })
}));

jest.mock('../../services/geocodingService', () => ({
  geocodeLocation: jest.fn().mockResolvedValue({
    coordinates: [46.2276, 2.2137],
    displayName: 'Test Location'
  }),
  generateRouteCoordinates: jest.fn().mockResolvedValue([
    [46.2276, 2.2137], [46.3276, 2.3137], [46.4276, 2.4137]
  ])
}));

jest.mock('../../services/routingService', () => ({
  getRouteCoordinates: jest.fn().mockResolvedValue({
    coordinates: [[46.2276, 2.2137], [46.3276, 2.3137], [46.4276, 2.4137]],
    distance: 50,
    duration: 120,
    difficulty: 'moderate',
    source: 'mock-routing'
  }),
  isAvailable: jest.fn().mockReturnValue(true)
}));

// Now import the service after mocking
const llmService = require('../../services/llmService');

describe('LLM Service', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('generateRoute - Cycling Routes', () => {
    it('should generate cycling route successfully for France', async () => {
      // Arrange: Mock the Google GenAI response
      const mockGeminiResponse = {
        text: JSON.stringify({
          route: {
            day1: {
              start: "Paris",
              end: "Fontainebleau", 
              distance: 55,
              waypoints: ["Melun", "Barbizon"]
            },
            day2: {
              start: "Fontainebleau",
              end: "Sens",
              distance: 45,
              waypoints: ["Montereau", "Pont-sur-Yonne"]
            },
            totalDistance: 100,
            estimatedDuration: "2 days",
            difficulty: "moderate"
          }
        })
      };

      mockGenerateContent.mockResolvedValue(mockGeminiResponse);

      // Act: Call the service
      const result = await llmService.generateRoute('France', 'cycling', 'Paris');

      // Assert: Verify the results
      expect(result).toBeDefined();
      expect(result.country).toBe('France');
      expect(result.city).toBe('Paris');
      expect(result.tripType).toBe('cycling');
      
      // Check route data structure
      expect(result.routeData).toBeDefined();
      expect(result.routeData.dailyRoutes).toHaveLength(2);
      expect(result.routeData.totalDistance).toBe(100);
      
      // Check day 1 details
      const day1 = result.routeData.dailyRoutes[0];
      expect(day1.day).toBe(1);
      expect(day1.startPoint).toBe('Paris');
      expect(day1.endPoint).toBe('Fontainebleau');
      expect(day1.distance).toBe(55);
      expect(day1.waypoints).toEqual(['Melun', 'Barbizon']);
      
      // Check day 2 details  
      const day2 = result.routeData.dailyRoutes[1];
      expect(day2.day).toBe(2);
      expect(day2.startPoint).toBe('Fontainebleau');
      expect(day2.endPoint).toBe('Sens');
      expect(day2.distance).toBe(45);
      
      // Verify generation metadata
      expect(result.generationMetadata).toBeDefined();
      expect(result.generationMetadata.llmModel).toContain('gemini');
      expect(result.generationMetadata.processingTime).toBeGreaterThan(0);
      
      // Verify the GenAI API was called
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should handle cycling route distance validation', async () => {
      // Arrange: Mock response with distances that are too high
      const mockInvalidResponse = {
        text: JSON.stringify({
          route: {
            day1: {
              start: "Berlin",
              end: "Munich",
              distance: 80,
              waypoints: ["Leipzig"]
            },
            day2: {
              start: "Munich", 
              end: "Salzburg",
              distance: 70,
              waypoints: ["Rosenheim"]
            },
            totalDistance: 150,
            estimatedDuration: "2 days",
            difficulty: "hard"
          }
        })
      };

      mockGenerateContent.mockResolvedValue(mockInvalidResponse);

      // Act & Assert: Should throw validation error
      await expect(
        llmService.generateRoute('Germany', 'cycling', 'Berlin')
      ).rejects.toThrow(/distance.*exceeds.*60km/i);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('generateRoute - Trekking Routes', () => {
    it('should generate circular trekking route successfully', async () => {
      // Arrange: Mock trekking route response
      const mockTrekkingResponse = {
        text: JSON.stringify({
          route: {
            day1: {
              start: "Chamonix Trailhead",
              end: "Chamonix Trailhead",
              distance: 12,
              waypoints: ["Lac Blanc", "Aiguille Rouge", "Flégère"]
            },
            totalDistance: 12,
            estimatedDuration: "1 day", 
            difficulty: "moderate"
          }
        })
      };

      mockGenerateContent.mockResolvedValue(mockTrekkingResponse);

      // Act: Generate trekking route
      const result = await llmService.generateRoute('France', 'trekking', 'Chamonix');

      // Assert: Verify trekking-specific requirements
      expect(result.tripType).toBe('trekking');
      expect(result.routeData.dailyRoutes).toHaveLength(1);
      
      const day1 = result.routeData.dailyRoutes[0];
      expect(day1.startPoint).toBe(day1.endPoint); // Circular route
      expect(day1.distance).toBe(12);
      expect(day1.distance).toBeGreaterThanOrEqual(5);
      expect(day1.distance).toBeLessThanOrEqual(15);
      
      expect(result.routeData.totalDistance).toBe(12);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle Gemini API failures gracefully', async () => {
      // Arrange: Mock API failure for all attempts
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      // Act & Assert: Should handle API failure
      await expect(
        llmService.generateRoute('Italy', 'cycling', 'Rome')
      ).rejects.toThrow(/Failed to generate route/i);

      // Verify multiple retry attempts were made
      expect(mockGenerateContent).toHaveBeenCalled();
    }, 20000); // Increased timeout for retry logic

    it('should handle malformed JSON responses', async () => {
      // Arrange: Mock response with invalid JSON
      const mockMalformedResponse = {
        text: 'This is not valid JSON { invalid json'
      };

      mockGenerateContent.mockResolvedValue(mockMalformedResponse);

      // Act & Assert: Should handle parsing error
      await expect(
        llmService.generateRoute('Spain', 'cycling', 'Madrid')
      ).rejects.toThrow(/Failed to process.*response/i);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should fallback to secondary model when primary fails', async () => {
      // Arrange: Mock ALL primary model attempts to fail, then secondary succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))  // Primary attempt 1
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))  // Primary attempt 2  
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))  // Primary attempt 3
        .mockResolvedValueOnce({                                   // Secondary model succeeds
          text: JSON.stringify({
            route: {
              day1: {
                start: "Barcelona",
                end: "Girona",
                distance: 50,
                waypoints: ["Mataró"]
              },
              day2: {
                start: "Girona", 
                end: "Figueres",
                distance: 40,
                waypoints: ["Banyoles"]
              },
              totalDistance: 90,
              estimatedDuration: "2 days",
              difficulty: "moderate"
            }
          })
        });

      // Act: Should use fallback model after primary fails completely
      const result = await llmService.generateRoute('Spain', 'cycling', 'Barcelona');

      // Assert: Verify fallback worked
      expect(result).toBeDefined();
      expect(result.generationMetadata.llmModel).toContain('flash');
      
      // Verify 4 total API calls were made (3 primary failures + 1 secondary success)
      expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    }, 25000); // Increased timeout for all retry attempts
  });

  describe('Service Integration', () => {
    it('should integrate with geocoding and routing services', async () => {
      // Arrange: Mock a successful response with VALID trekking distance
      const mockResponse = {
        text: JSON.stringify({
          route: {
            day1: {
              start: "Nice Trailhead",
              end: "Nice Trailhead", // Circular route for trekking
              distance: 8, // Valid trekking distance (5-15km)
              waypoints: ["Èze Village", "Moyenne Corniche"]
            },
            totalDistance: 8,
            estimatedDuration: "1 day",
            difficulty: "easy"
          }
        })
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      // Act: Generate route
      const result = await llmService.generateRoute('France', 'trekking', 'Nice');

      // Assert: Verify integration with other services
      expect(result.routeData.coordinates).toBeDefined();
      expect(result.routeData.coordinates.length).toBeGreaterThan(0);
      
      // Check that image service was called
      expect(result.imageData).toBeDefined();
      expect(result.imageUrl).toBeDefined();

      // Verify routing metadata
      expect(result.routingMetadata).toBeDefined();
      
      // Verify trekking constraints are met
      expect(result.routeData.totalDistance).toBe(8);
      expect(result.routeData.dailyRoutes).toHaveLength(1);
    }, 15000);
  });
});