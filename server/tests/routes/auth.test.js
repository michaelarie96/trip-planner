const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../../models/user');

// Import your auth routes
const authRoutes = require('../../routes/auth');

// Create a complete test app with all necessary middleware
const createTestApp = () => {
  const app = express();
  
  // Add necessary middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add your auth routes
  app.use('/api/auth', authRoutes);
  
  // Error handling middleware (important for catching 500 errors)
  app.use((err, req, res, next) => {
    console.error('Test app error:', err);
    res.status(500).json({
      message: 'Test server error',
      error: err.message
    });
  });
  
  return app;
};

describe('Auth Routes', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Debug logging if there's an error
      if (response.status !== 201) {
        console.log('Response status:', response.status);
        console.log('Response body:', response.body);
        console.log('Response text:', response.text);
      }

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.name).toBe('John Doe');
      expect(response.body.user.email).toBe('john@example.com');
      expect(response.body.user.password).toBeUndefined();

      // Verify user was actually saved to database
      const savedUser = await User.findOne({ email: 'john@example.com' });
      expect(savedUser).toBeDefined();
      expect(savedUser.name).toBe('John Doe');
    });

    it('should not register user with missing fields', async () => {
      const incompleteData = {
        name: 'John Doe'
        // Missing email and password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
      expect(Array.isArray(response.body.errors)).toBe(true);
    });

    it('should not register user with invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should not register user with short password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should not register user with duplicate email', async () => {
      // Create first user
      const userData = {
        name: 'First User',
        email: 'duplicate@example.com',
        password: 'password123'
      };

      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(firstResponse.status).toBe(201);

      // Try to register with same email
      const duplicateUserData = {
        name: 'Second User',
        email: 'duplicate@example.com',
        password: 'password456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUserData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User with this email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    const createTestUser = async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      return userData;
    };

    it('should login user with correct credentials', async () => {
      const userData = await createTestUser();

      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // Debug logging
      if (response.status !== 200) {
        console.log('Login response status:', response.status);
        console.log('Login response body:', response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.password).toBeUndefined();
    });

    it('should not login with incorrect password', async () => {
      const userData = await createTestUser();

      const loginData = {
        email: userData.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid email or password');
      expect(response.body.token).toBeUndefined();
    });

    it('should not login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid email or password');
      expect(response.body.token).toBeUndefined();
    });

    it('should not login with missing credentials', async () => {
      const incompleteData = {
        email: 'test@example.com'
        // Missing password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(incompleteData);

      expect(response.status).toBe(400);
      // Fix the assertion - your auth route returns "Invalid email or password" for missing fields
      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/verify', () => {
    it('should verify valid JWT token', async () => {
      // First register a user to get a token
      const userData = {
        name: 'Verify User',
        email: 'verify@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      const token = registerResponse.body.token;

      // Now verify the token
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      // Debug logging
      if (response.status !== 200) {
        console.log('Verify response status:', response.status);
        console.log('Verify response body:', response.body);
        console.log('Token used:', token);
      }

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token is valid');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('verify@example.com');
    });

    it('should reject invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token is required');
    });
  });
});