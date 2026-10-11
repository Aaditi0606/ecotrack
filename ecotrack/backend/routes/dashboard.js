const express = require('express');
const { Activity } = require('../models/Activity');
const { calculateImpactFromFlask } = require('../services/impactService');

const router = express.Router();

/**
 * Helper: generates array of last 7 calendar days with format { dateStr, label, count: 0 }
 */
function getLast7DaysTemplate() {
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    days.push({
      date: dateKey,
      dayName: dayNames[d.getDay()],
      shortLabel: `${dayNames[d.getDay()]} ${day}`,
      count: 0
    });
  }
  return days;
}

/**
 * GET /api/dashboard
 * Aggregates summary statistics, calls the Flask microservice for carbon impact,
 * and compiles daily progress for visualization.
 */
router.get('/', async (req, res) => {
  try {
    // 1. Fetch total activity count
    const totalActivities = await Activity.countDocuments();

    // 2. Fetch "This Week" count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const thisWeekActivities = await Activity.countDocuments({
      activityDate: { $gte: sevenDaysAgo }
    });

    // 3. Fetch all activities for Flask calculation
    const allActivities = await Activity.find({}, 'activityType quantity activityDate')
      .lean();

    // 4. Fetch recent 10 activities for list display
    const recentActivities = await Activity.find({})
      .sort({ activityDate: -1, createdAt: -1 })
      .limit(10)
      .lean();

    // 5. Build daily progress for the last 7 days
    const dailyProgress = getLast7DaysTemplate();
    const dayMap = new Map();
    dailyProgress.forEach((item) => dayMap.set(item.date, item));

    allActivities.forEach((act) => {
      if (act.activityDate) {
        const actD = new Date(act.activityDate);
        const y = actD.getFullYear();
        const m = String(actD.getMonth() + 1).padStart(2, '0');
        const d = String(actD.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        if (dayMap.has(key)) {
          dayMap.get(key).count += 1;
        }
      }
    });

    // 6. Query Python Flask calculation microservice for science-backed estimates
    let impactData = {
      total_co2e_saved_kg: 0,
      tangible_metrics: {
        bottles_diverted: 0,
        clean_transit_km: 0,
        waste_sorting_sessions: 0,
        trees_stewarded: 0
      },
      category_totals: {},
      is_estimate: true,
      service_status: 'ok',
      engine: 'Flask (Python)'
    };

    if (allActivities.length > 0) {
      impactData = await calculateImpactFromFlask(allActivities);
    }

    return res.status(200).json({
      success: true,
      data: {
        totalActivities,
        thisWeekActivities,
        impact: impactData,
        dailyProgress,
        recentActivities,
        isEmpty: totalActivities === 0
      }
    });
  } catch (error) {
    console.error('Error generating dashboard summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate dashboard statistics'
    });
  }
});

/**
 * POST /api/impact/calculate
 * Direct calculation endpoint passing specific input through the Flask microservice
 */
router.post('/impact/calculate', async (req, res) => {
  try {
    const { activities, activityType, quantity } = req.body;
    let listToCalculate = [];

    if (Array.isArray(activities)) {
      listToCalculate = activities;
    } else if (activityType && quantity) {
      listToCalculate = [{ activityType, quantity }];
    } else {
      return res.status(400).json({
        success: false,
        error: "Provide either 'activities' array or 'activityType' and 'quantity'."
      });
    }

    const result = await calculateImpactFromFlask(listToCalculate);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error calculating custom impact:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process environmental calculation'
    });
  }
});

module.exports = router;
