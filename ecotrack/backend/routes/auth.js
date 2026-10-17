const express = require('express');
const { User, generateToken, verifyPassword } = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    // 1. Validate username
    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Username is required.'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 30 characters.'
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Username can only contain letters, numbers, and underscores.'
      });
    }

    // 2. Validate password
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Password is required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    // 3. Check for existing username
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Username is already taken. Please choose another.'
      });
    }

    // 4. Create new user
    const newUser = await User.create({
      username: cleanUsername,
      password,
      displayName: (displayName && typeof displayName === 'string') ? displayName.trim() : cleanUsername
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to EcoTrack.',
      token,
      user: {
        id: newUser._id ? newUser._id.toString() : newUser.id,
        username: newUser.username,
        displayName: newUser.displayName || newUser.username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Username is already taken.'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during account creation.'
    });
  }
});

/**
 * POST /api/auth/login
 * Log in with existing credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both username and password.'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.'
      });
    }

    // Verify password
    const isValid = verifyPassword(password, user.salt, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.'
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.displayName || user.username}!`,
      token,
      user: {
        id: user._id ? user._id.toString() : user.id,
        username: user.username,
        displayName: user.displayName || user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during sign in.'
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieve the current authenticated user's profile
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User account not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id ? user._id.toString() : user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Log out (client discards token)
 */
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
