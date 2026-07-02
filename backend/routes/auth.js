const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/authMiddleware');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

/**
 * POST /api/auth/register
 * Closed (admin-only) registration model — this public endpoint only BOOTSTRAPS
 * the very first account (promoted to admin) when the system has no users yet.
 * Once any user exists, self-signup is disabled and further accounts are created
 * by an admin via POST /api/auth/register-viewer.
 */
router.post('/register', async (req, res) => {
  try {
    // Gate: only allow registration when the system is empty (first-run setup).
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.status(403).json({
        error: 'Registration is closed. Ask an administrator to create your account.',
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // First account is the administrator (owns user + server management).
    const user = new User({ name, email, password, role: 'admin' });
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Administrator account created successfully.',
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful.',
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/auth/logout
 * Client-side token invalidation (placeholder for future blacklist)
 */
router.post('/logout', auth, async (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

/**
 * PUT /api/auth/me
 * Update user profile (name, email, password, emailNotifications)
 */
router.put('/me', auth, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword, emailNotifications } = req.body;
    const user = req.user;

    // Update name
    if (name !== undefined) user.name = name;

    // Update email
    if (email !== undefined) {
      const existingUser = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use.' });
      }
      user.email = email.toLowerCase();
    }

    // Update password
    if (currentPassword && newPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }
      user.password = newPassword;
    }

    // Update email notifications preference
    if (emailNotifications !== undefined) {
      user.emailNotifications = emailNotifications;
    }

    await user.save();

    res.json({ message: 'Profile updated successfully.', user: user.toJSON() });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/auth/users
 * List all users (admin only)
 */
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users: users.map((u) => u.toJSON()) });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/auth/register-viewer
 * Admin creates a new Viewer (read-only) account
 */
router.post('/register-viewer', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Force role to 'user' (Viewer) — admins are not created via this route
    const user = new User({ name, email, password, role: 'user' });
    await user.save();

    res.status(201).json({
      message: 'Viewer account created successfully.',
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Error creating viewer:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * PATCH /api/auth/users/:id/toggle-status
 * Activate / deactivate a user account (admin only)
 */
router.patch('/users/:id/toggle-status', auth, adminOnly, async (req, res) => {
  try {
    // Prevent an admin from locking themselves out
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot change your own active status.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Error toggling user status:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
