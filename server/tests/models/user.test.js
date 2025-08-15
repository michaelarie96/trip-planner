const mongoose = require('mongoose');
const User = require('../../models/user');

describe('User Model', () => {
  // Test user creation with valid data
  describe('User Creation', () => {
    it('should create a valid user with correct data', async () => {
      // Arrange: Set up test data
      const validUserData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      // Act: Create the user
      const user = new User(validUserData);
      const savedUser = await user.save();

      // Assert: Check the results
      expect(savedUser.name).toBe('John Doe');
      expect(savedUser.email).toBe('john@example.com');
      expect(savedUser.password).not.toBe('password123'); // Should be hashed
      expect(savedUser.password.length).toBeGreaterThan(50); // Hashed passwords are long
      expect(savedUser._id).toBeDefined();
      expect(savedUser.createdAt).toBeDefined();
    });

    it('should hash the password before saving', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'plaintext123'
      };

      const user = new User(userData);
      await user.save();

      // Password should be hashed, not plain text
      expect(user.password).not.toBe('plaintext123');
      expect(user.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('should be able to compare passwords correctly', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'mypassword'
      };

      const user = new User(userData);
      await user.save();

      // Test correct password
      const isMatch = await user.comparePassword('mypassword');
      expect(isMatch).toBe(true);

      // Test incorrect password
      const isNotMatch = await user.comparePassword('wrongpassword');
      expect(isNotMatch).toBe(false);
    });
  });

  // Test validation errors
  describe('User Validation', () => {
    it('should not create user without required fields', async () => {
      const user = new User({});

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    it('should not create user with invalid email', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      };

      const user = new User(userData);

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    it('should not create user with short password', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: '123' // Too short
      };

      const user = new User(userData);

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    it('should not create duplicate users with same email', async () => {
      // Create first user
      const userData1 = {
        name: 'User One',
        email: 'duplicate@example.com',
        password: 'password123'
      };
      const user1 = new User(userData1);
      await user1.save();

      // Try to create second user with same email
      const userData2 = {
        name: 'User Two',
        email: 'duplicate@example.com', // Same email
        password: 'password456'
      };
      const user2 = new User(userData2);

      let error;
      try {
        await user2.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // MongoDB duplicate key error
    });
  });

  // Test user methods
  describe('User Methods', () => {
    it('should not include password in JSON output', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = new User(userData);
      await user.save();

      const userJSON = user.toJSON();
      expect(userJSON.password).toBeUndefined();
      expect(userJSON.name).toBe('Test User');
      expect(userJSON.email).toBe('test@example.com');
    });
  });
});