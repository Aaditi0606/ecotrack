const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const activitiesRouter = require('./routes/activities');
const dashboardRouter = require('./routes/dashboard');
const { FLASK_SERVICE_URL } = require('./services/impactService');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecotrack';

// Middleware
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Request logger for visibility during development and cloud deployment
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount REST API endpoints
app.use('/api/activities', activitiesRouter);
app.use('/api/dashboard', dashboardRouter);

// System Health Check
app.get('/api/health', async (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const dbStatus = isMongoConnected ? 'connected (Mongoose / MongoDB)' : 'active (embedded file persistence fallback)';
  let flaskStatus = 'unknown';

  try {
    const flaskRes = await fetch(`${FLASK_SERVICE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    flaskStatus = flaskRes.ok ? 'connected' : `status_${flaskRes.status}`;
  } catch {
    flaskStatus = 'offline (Node fallback calculations active)';
  }

  return res.status(200).json({
    status: 'ok',
    service: 'EcoTrack Node.js/Express Server',
    database: {
      engine: isMongoConnected ? 'MongoDB' : 'Fallback File/Memory Store',
      status: dbStatus,
      connectionString: isMongoConnected ? MONGODB_URI : 'Local persistence active'
    },
    microservice: {
      name: 'Python/Flask Calculation Engine',
      url: FLASK_SERVICE_URL,
      status: flaskStatus
    },
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Serve Frontend static assets
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Fallback route for single-page application navigation
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

// Helper: Automatically ensure Python Flask service is running
async function ensureFlaskServiceRunning() {
  const isLocalFlask = FLASK_SERVICE_URL.includes('127.0.0.1') || FLASK_SERVICE_URL.includes('localhost');
  if (!isLocalFlask) return;

  try {
    const res = await fetch(`${FLASK_SERVICE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      console.log('✅ [Flask] Connected to active Python Flask calculation microservice.');
      return;
    }
  } catch {
    // If not running, automatically spawn it
    console.log('🚀 [Flask] Launching Python Flask calculation microservice...');
    const pythonExe = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    const flaskScript = path.join(__dirname, '../flask-service/app.py');

    try {
      const flaskProcess = spawn(pythonExe, [flaskScript], {
        stdio: 'inherit',
        env: { ...process.env, FLASK_PORT: process.env.FLASK_PORT || '5001' }
      });

      flaskProcess.on('error', (err) => {
        console.warn('⚠️ [Flask] Could not auto-start python process:', err.message);
      });

      const cleanup = () => {
        try { flaskProcess.kill(); } catch {}
      };
      process.on('exit', cleanup);
      process.on('SIGINT', () => { cleanup(); process.exit(); });
      process.on('SIGTERM', () => { cleanup(); process.exit(); });

      // Wait a moment for startup
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (e) {
      console.warn('⚠️ [Flask] Failed to auto-spawn Flask process:', e.message);
    }
  }
}

// Database Connection & Server Startup
async function startServer() {
  // Ensure Flask service is ready
  await ensureFlaskServiceRunning();

  try {
    console.log(`[MongoDB] Attempting connection to ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000
    });
    console.log('✅ [MongoDB] Connected successfully to live MongoDB instance via Mongoose.');
  } catch (err) {
    console.warn(`⚠️ [MongoDB] Live MongoDB server not reachable at ${MONGODB_URI} (${err.message}).`);
    console.log('ℹ️ [MongoDB] Activating zero-config embedded persistence store so EcoTrack works immediately without setup.');
    console.log('💡 [MongoDB] To connect to a live MongoDB server, start mongod or set MONGODB_URI in your .env file.');
  }

  app.listen(PORT, () => {
    console.log(`
=============================================================
  🌿 EcoTrack - Personal Sustainability Tracker is Running!
=============================================================
  - Web Application: http://localhost:${PORT}
  - API Base URL:    http://localhost:${PORT}/api/dashboard
  - Health Check:    http://localhost:${PORT}/api/health
  - Flask Service:   ${FLASK_SERVICE_URL}
=============================================================
`);
  });
}

startServer();

module.exports = app;
