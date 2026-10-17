const { verifyToken, User } = require('../models/User');

/**
 * Optional authentication middleware:
 * Populates req.user if a valid Bearer token is provided.
 * Does not block unauthenticated requests.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const payload = verifyToken(token);
      if (payload && payload.userId) {
        req.user = {
          id: payload.userId,
          userId: payload.userId,
          username: payload.username
        };
      }
    }
  } catch (err) {
    console.warn('[AuthMiddleware] Optional auth error:', err.message);
  }
  next();
}

/**
 * Required authentication middleware:
 * Blocks requests if not authenticated.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({
      success: false,
      error: 'Session expired or invalid token. Please log in again.'
    });
  }

  req.user = {
    id: payload.userId,
    userId: payload.userId,
    username: payload.username
  };
  next();
}

module.exports = {
  optionalAuth,
  requireAuth
};
