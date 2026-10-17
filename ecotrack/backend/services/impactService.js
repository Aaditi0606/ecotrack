/**
 * EcoTrack Impact Service
 * Acts as the bridge between Node.js and the Python Flask Environmental Calculation Microservice.
 */

function formatServiceUrl(rawUrl, defaultPort = 5001) {
  if (!rawUrl || typeof rawUrl !== 'string') return `http://127.0.0.1:${defaultPort}`;
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (!clean) return `http://127.0.0.1:${defaultPort}`;
  if (!/^https?:\/\//i.test(clean)) {
    if (clean.includes('.onrender.com')) {
      clean = `https://${clean}`;
    } else if (!clean.includes(':')) {
      // Internal Render host like 'ecotrack-flask-service' without port
      clean = `http://${clean}:10000`;
    } else {
      clean = `http://${clean}`;
    }
  }
  return clean;
}

const FLASK_SERVICE_URL = formatServiceUrl(process.env.FLASK_SERVICE_URL);

// Baseline fallback factors if Flask service is temporarily unreachable
const FALLBACK_FACTORS = {
  reusable_bottle: { co2e: 0.083, unit: 'bottles avoided' },
  public_transport: { co2e: 0.102, unit: 'km traveled' },
  cycling_walking: { co2e: 0.170, unit: 'km walked/cycled' },
  waste_segregation: { co2e: 0.120, unit: 'sessions' },
  tree_care: { co2e: 0.060, unit: 'trees nurtured' }
};

/**
 * Calculates aggregate impact by sending activity data to the Flask calculation microservice.
 * @param {Array} activities - Array of { activityType, quantity }
 * @returns {Promise<Object>} Calculated environmental impact and metadata
 */
async function calculateImpactFromFlask(activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    return {
      success: true,
      total_activities_computed: 0,
      total_co2e_saved_kg: 0,
      category_totals: {},
      tangible_metrics: {
        bottles_diverted: 0,
        clean_transit_km: 0,
        waste_sorting_sessions: 0,
        trees_stewarded: 0
      },
      is_estimate: true,
      service_status: 'ok',
      engine: 'Flask (Python)'
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    const response = await fetch(`${FLASK_SERVICE_URL}/calculate-impact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ activities }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        ...data,
        service_status: 'connected',
        engine: 'Flask (Python Microservice)'
      };
    } else {
      console.warn(`[ImpactService] Flask service responded with HTTP ${response.status}. Using fallback calculations.`);
      return computeLocalFallback(activities, `Flask service HTTP error: ${response.status}`);
    }
  } catch (error) {
    console.warn(`[ImpactService] Unable to reach Flask microservice at ${FLASK_SERVICE_URL}. Using graceful fallback calculations.`, error.message);
    return computeLocalFallback(activities, 'Flask service offline or unreachable');
  }
}

/**
 * Local fallback calculation in case the Flask microservice is offline
 */
function computeLocalFallback(activities, reason) {
  let totalCo2 = 0;
  let bottlesDiverted = 0;
  let cleanKm = 0;
  let wasteSessions = 0;
  let treesCared = 0;

  const categoryTotals = {};

  activities.forEach((act) => {
    const type = act.activityType || act.activity_type;
    const qty = Number(act.quantity) || 0;
    if (qty <= 0) return;

    const factor = FALLBACK_FACTORS[type];
    const co2Saved = factor ? qty * factor.co2e : 0;
    totalCo2 += co2Saved;

    if (!categoryTotals[type]) {
      categoryTotals[type] = {
        label: type,
        quantity: 0,
        unit: factor ? factor.unit : 'units',
        co2e_saved_kg: 0
      };
    }
    categoryTotals[type].quantity += qty;
    categoryTotals[type].co2e_saved_kg = Math.round((categoryTotals[type].co2e_saved_kg + co2Saved) * 100) / 100;

    if (type === 'reusable_bottle') bottlesDiverted += qty;
    if (type === 'public_transport' || type === 'cycling_walking') cleanKm += qty;
    if (type === 'waste_segregation') wasteSessions += qty;
    if (type === 'tree_care') treesCared += qty;
  });

  return {
    success: true,
    total_activities_computed: activities.length,
    total_co2e_saved_kg: Math.round(totalCo2 * 100) / 100,
    category_totals: categoryTotals,
    tangible_metrics: {
      bottles_diverted: Math.round(bottlesDiverted),
      clean_transit_km: Math.round(cleanKm * 10) / 10,
      waste_sorting_sessions: Math.round(wasteSessions),
      trees_stewarded: Math.round(treesCared)
    },
    is_estimate: true,
    service_status: 'fallback',
    engine: 'Node.js Local Fallback (Flask offline)',
    fallback_reason: reason,
    assumptions: [
      'Estimates rely on recognized life-cycle carbon accounting values (EPA WARM & UK DEFRA).',
      'Reusable bottle: 0.083 kg CO2e / bottle avoided.',
      'Public transport: 0.102 kg CO2e / km saved compared to petrol car.',
      'Cycling/walking: 0.170 kg CO2e / km displaced.',
      'Waste segregation: 0.120 kg CO2e / session diverted.',
      'Tree care: 0.060 kg CO2 / tree / week of urban stewardship.'
    ]
  };
}

module.exports = {
  calculateImpactFromFlask,
  FLASK_SERVICE_URL
};
