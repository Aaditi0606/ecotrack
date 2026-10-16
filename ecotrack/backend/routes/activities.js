const express = require('express');
const mongoose = require('mongoose');
const { Activity, ALLOWED_ACTIVITY_TYPES } = require('../models/Activity');

const router = express.Router();

/**
 * GET /api/activities
 * Retrieve activity records, sorted by date (newest first)
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};

    if (req.query.type && ALLOWED_ACTIVITY_TYPES.includes(req.query.type)) {
      filter.activityType = req.query.type;
    }

    const activities = await Activity.find(filter)
      .sort({ activityDate: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve activities from database'
    });
  }
});

/**
 * POST /api/activities
 * Log a new eco-friendly activity
 */
router.post('/', async (req, res) => {
  try {
    const { activityType, activityDate, quantity, description } = req.body;

    // 1. Validate activityType
    if (!activityType || typeof activityType !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Activity type is required.'
      });
    }

    const trimmedType = activityType.trim();
    if (!ALLOWED_ACTIVITY_TYPES.includes(trimmedType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid activity type '${trimmedType}'. Allowed: ${ALLOWED_ACTIVITY_TYPES.join(', ')}`
      });
    }

    // 2. Validate quantity
    const numQuantity = Number(quantity);
    if (!quantity || isNaN(numQuantity) || numQuantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number greater than 0.'
      });
    }

    // 3. Validate activityDate
    if (!activityDate) {
      return res.status(400).json({
        success: false,
        error: 'Activity date is required.'
      });
    }

    const parsedDate = new Date(activityDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Activity date is not a valid date.'
      });
    }

    // Reject future dates (allow up to tomorrow 00:00 UTC for timezone margin)
    const maxAllowedDate = new Date();
    maxAllowedDate.setDate(maxAllowedDate.getDate() + 1);
    if (parsedDate > maxAllowedDate) {
      return res.status(400).json({
        success: false,
        error: 'Activity date cannot be in the future.'
      });
    }

    // 4. Validate optional description
    let cleanDescription = '';
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Description must be text.'
        });
      }
      cleanDescription = description.trim();
      if (cleanDescription.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'Description cannot exceed 200 characters.'
        });
      }
    }

    // Create activity in MongoDB
    const newActivity = await Activity.create({
      activityType: trimmedType,
      activityDate: parsedDate,
      quantity: numQuantity,
      description: cleanDescription
    });

    return res.status(201).json({
      success: true,
      message: 'Eco action recorded successfully!',
      data: newActivity
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: messages.join('; ')
      });
    }
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while saving the activity.'
    });
  }
});

/**
 * PUT /api/activities/:id
 * Update an existing eco-friendly activity record
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) && !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid activity record ID format.'
      });
    }

    const { activityType, activityDate, quantity, description } = req.body;
    const updates = {};

    if (activityType !== undefined) {
      if (typeof activityType !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Activity type must be text.'
        });
      }
      const trimmedType = activityType.trim();
      if (!ALLOWED_ACTIVITY_TYPES.includes(trimmedType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid activity type '${trimmedType}'. Allowed: ${ALLOWED_ACTIVITY_TYPES.join(', ')}`
        });
      }
      updates.activityType = trimmedType;
    }

    if (quantity !== undefined) {
      const numQuantity = Number(quantity);
      if (isNaN(numQuantity) || numQuantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Quantity must be a positive number greater than 0.'
        });
      }
      updates.quantity = numQuantity;
    }

    if (activityDate !== undefined) {
      const parsedDate = new Date(activityDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Activity date is not a valid date.'
        });
      }
      const maxAllowedDate = new Date();
      maxAllowedDate.setDate(maxAllowedDate.getDate() + 1);
      if (parsedDate > maxAllowedDate) {
        return res.status(400).json({
          success: false,
          error: 'Activity date cannot be in the future.'
        });
      }
      updates.activityDate = parsedDate;
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Description must be text.'
        });
      }
      const cleanDescription = description.trim();
      if (cleanDescription.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'Description cannot exceed 200 characters.'
        });
      }
      updates.description = cleanDescription;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update.'
      });
    }

    const updated = await Activity.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Activity record not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Activity updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: messages.join('; ')
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to update activity record.'
    });
  }
});

/**
 * DELETE /api/activities/:id
 * Delete a selected activity by ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid activity record ID format.'
      });
    }

    const deleted = await Activity.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Activity record not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Activity removed successfully.',
      data: { id }
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete activity record.'
    });
  }
});

module.exports = router;
