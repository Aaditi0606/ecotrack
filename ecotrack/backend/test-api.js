/**
 * EcoTrack API & Integration Test Suite
 * Validates REST API endpoints, form validations, Flask calculation communication, and CRUD cycles.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const FLASK_URL = process.env.FLASK_SERVICE_URL || 'http://127.0.0.1:5001';

async function runTests() {
  console.log('======================================================');
  console.log('🧪 Starting EcoTrack Full-Stack Verification Tests');
  console.log('======================================================\n');
  let passed = 0;
  let failed = 0;

  async function assert(testName, testFn) {
    try {
      await testFn();
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${testName}: ${err.message}`);
      failed++;
    }
  }

  // 0. Test URI Masking Helper (Prevents Credential Leakage)
  await assert('maskMongoUri safely masks credentials', async () => {
    const app = require('./server');
    const mask = app.maskMongoUri;
    if (typeof mask !== 'function') throw new Error('maskMongoUri is not exported');

    const testUri1 = 'mongodb+srv://adminUser:MySecretPassword123@cluster0.mongodb.net/ecotrack?retryWrites=true';
    const masked1 = mask(testUri1);
    if (masked1.includes('MySecretPassword123')) throw new Error('Password was not masked in Atlas URI');
    if (!masked1.startsWith('mongodb+srv://adminUser:*****@cluster0.mongodb.net/')) throw new Error(`Unexpected masked format: ${masked1}`);

    const testUri2 = 'mongodb://127.0.0.1:27017/ecotrack';
    const masked2 = mask(testUri2);
    if (masked2 !== testUri2) throw new Error(`Unexpected change to passwordless URI: ${masked2}`);
  });

  // 1. Test Flask calculation service directly
  await assert('Flask Service /health endpoint', async () => {
    const res = await fetch(`${FLASK_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Unexpected status: ${data.status}`);
  });

  await assert('Flask Service /calculate-impact endpoint', async () => {
    const res = await fetch(`${FLASK_URL}/calculate-impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activities: [
          { activityType: 'reusable_bottle', quantity: 4 },
          { activityType: 'cycling_walking', quantity: 10 }
        ]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success || data.total_co2e_saved_kg <= 0) {
      throw new Error(`Invalid calculation result: ${JSON.stringify(data)}`);
    }
  });

  // 2. Test Node.js /api/health
  await assert('Node.js /api/health endpoint returns clear database status', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status 'ok', got ${data.status}`);
    if (!data.database || typeof data.database.connected !== 'boolean') {
      throw new Error('Health check missing database.connected boolean');
    }
    if (!data.database.engine || !data.database.status) {
      throw new Error('Health check missing database engine or status description');
    }
    if (data.database.maskedUri && data.database.maskedUri.includes(':') && data.database.maskedUri.includes('@')) {
      const match = data.database.maskedUri.match(/:\/\/[^:]+:([^@]+)@/);
      if (match && match[1] !== '*****') {
        throw new Error('Raw database password detected in health endpoint!');
      }
    }
  });

  // 3. Test Dashboard endpoint
  await assert('GET /api/dashboard returns structure', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || typeof json.data.totalActivities !== 'number') {
      throw new Error('Malformed dashboard response');
    }
  });

  // 4. Test Validation: Invalid activityType rejected
  await assert('POST /api/activities rejects invalid type', async () => {
    const res = await fetch(`${BASE_URL}/api/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: 'driving_diesel_truck',
        activityDate: '2026-10-11',
        quantity: 5
      })
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    const json = await res.json();
    if (json.success !== false) throw new Error('Expected failure response');
  });

  // 5. Test Validation: Negative quantity rejected
  await assert('POST /api/activities rejects negative quantity', async () => {
    const res = await fetch(`${BASE_URL}/api/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: 'reusable_bottle',
        activityDate: '2026-10-11',
        quantity: -3
      })
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 6. Test Valid Activity Creation
  let createdId = null;
  await assert('POST /api/activities saves valid record', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${BASE_URL}/api/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: 'public_transport',
        activityDate: today,
        quantity: 12,
        description: 'Automated test metro trip'
      })
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data._id) throw new Error('No activity ID returned');
    createdId = json.data._id;
  });

  // 7. Test Activity Retrieval
  await assert('GET /api/activities lists created record', async () => {
    const res = await fetch(`${BASE_URL}/api/activities`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const found = json.data.some((a) => a._id === createdId);
    if (!found) throw new Error(`Created activity ${createdId} not found in list`);
  });

  // 7.1 Test Activity Update (PUT)
  await assert('PUT /api/activities/:id updates record', async () => {
    if (!createdId) throw new Error('No created record to update');
    const res = await fetch(`${BASE_URL}/api/activities/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: 18,
        description: 'Updated metro trip description'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || json.data.quantity !== 18 || json.data.description !== 'Updated metro trip description') {
      throw new Error(`Update verification failed: ${JSON.stringify(json)}`);
    }
  });

  // 7.2 Test Activity Update Validation Rejection
  await assert('PUT /api/activities/:id rejects invalid quantity', async () => {
    if (!createdId) throw new Error('No created record to test');
    const res = await fetch(`${BASE_URL}/api/activities/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: -5
      })
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 8. Test Node-to-Flask pass-through calculation
  await assert('POST /api/dashboard/impact/calculate calculates impact', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/impact/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: 'tree_care',
        quantity: 2
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Calculation failed');
  });

  // 9. Test Activity Deletion
  await assert('DELETE /api/activities/:id removes record', async () => {
    if (!createdId) throw new Error('No ID to delete');
    const res = await fetch(`${BASE_URL}/api/activities/${createdId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error('Failed to delete');
  });

  // 10. Test Idempotent Data Migration
  await assert('migrateFallbackDataToMongo is safe and idempotent', async () => {
    const { migrateFallbackDataToMongo } = require('./models/Activity');
    const result1 = await migrateFallbackDataToMongo();
    if (!result1 || typeof result1 !== 'object') throw new Error('Invalid migration return value');
    // Running second time must not create duplicates
    const result2 = await migrateFallbackDataToMongo();
    if (result2.migrated > 0) {
      throw new Error(`Second migration run inserted duplicate records: ${result2.migrated}`);
    }
  });

  // 11. Test User Authentication (Register, Login, Me, Duplicate Rejection)
  let authToken = null;
  const testUser = `user_${Date.now()}`;
  await assert('POST /api/auth/register creates new user account', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: 'password123', displayName: 'Test Runner' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.token) throw new Error('Registration failed');
    authToken = json.token;
  });

  await assert('POST /api/auth/login validates credentials and issues token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: 'password123' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.token) throw new Error('Login failed');
  });

  await assert('GET /api/auth/me returns current user profile with valid token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || json.user.username !== testUser) throw new Error('Me profile mismatch');
  });

  await assert('POST /api/auth/register rejects duplicate username', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUser, password: 'password123' })
    });
    if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
  });

  console.log('\n======================================================');
  console.log(`🏁 Test Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
