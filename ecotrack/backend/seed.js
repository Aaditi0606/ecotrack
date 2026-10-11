/**
 * Seed demonstration data for EcoTrack
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

function getDateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const SAMPLE_ACTIVITIES = [
  {
    activityType: 'reusable_bottle',
    activityDate: getDateOffset(0),
    quantity: 4,
    description: 'Refilled stainless steel bottle in campus canteen'
  },
  {
    activityType: 'cycling_walking',
    activityDate: getDateOffset(1),
    quantity: 6.5,
    description: 'Walked to engineering building and cycled to grocery market'
  },
  {
    activityType: 'public_transport',
    activityDate: getDateOffset(2),
    quantity: 14.0,
    description: 'Commuted by municipal electric bus instead of driving a car'
  },
  {
    activityType: 'waste_segregation',
    activityDate: getDateOffset(3),
    quantity: 2,
    description: 'Segregated organic vegetable scraps and rinsed dry plastics'
  },
  {
    activityType: 'tree_care',
    activityDate: getDateOffset(5),
    quantity: 1,
    description: 'Watered newly planted sapling outside campus student center'
  }
];

async function seed() {
  console.log('🌱 Seeding realistic demonstration activities...');
  for (const act of SAMPLE_ACTIVITIES) {
    try {
      const res = await fetch(`${BASE_URL}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(act)
      });
      const data = await res.json();
      console.log(`+ Logged: ${act.activityType} (${act.quantity}) -> ${data.success ? 'Success' : data.error}`);
    } catch (e) {
      console.error('Error logging seed item:', e.message);
    }
  }
  console.log('✅ Demo seeding complete.');
}

seed();
