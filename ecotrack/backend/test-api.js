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
  await assert('Node.js /api/health endpoint', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Expected status 'ok', got ${data.status}`);
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

  console.log('\n======================================================');
  console.log(`🏁 Test Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
