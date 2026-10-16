const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_ACTIVITY_TYPES = [
  'reusable_bottle',
  'public_transport',
  'cycling_walking',
  'waste_segregation',
  'tree_care'
];

// --- 1. Mongoose Schema Definition ---
const activitySchema = new mongoose.Schema(
  {
    activityType: {
      type: String,
      required: [true, 'Activity type is required'],
      enum: {
        values: ALLOWED_ACTIVITY_TYPES,
        message: 'Invalid activity type. Allowed: {VALUES}'
      },
      trim: true
    },
    activityDate: {
      type: Date,
      required: [true, 'Activity date is required'],
      validate: {
        validator: function (value) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return value instanceof Date && !isNaN(value) && value <= tomorrow;
        },
        message: 'Activity date cannot be in the future'
      }
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity or count is required'],
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: function (val) {
          return Number.isFinite(val) && val > 0;
        },
        message: 'Quantity must be a valid positive number'
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: ''
    }
  },
  {
    timestamps: true
  }
);

activitySchema.index({ activityDate: -1 });
activitySchema.index({ createdAt: -1 });
activitySchema.index({ activityType: 1 });

const MongooseActivity = mongoose.model('Activity', activitySchema);

// --- 2. Seamless Fallback Adapter (Activates when local MongoDB daemon is not running) ---
const DATA_FILE = path.join(__dirname, '../data/activities_store.json');

function loadFallbackData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[FallbackStore] Error reading store file:', err.message);
  }
  return [];
}

function saveFallbackData(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[FallbackStore] Error persisting data:', err.message);
  }
}

class FallbackQuery {
  constructor(data) {
    this._data = [...data];
  }

  sort(sortObj) {
    const [key, dir] = Object.entries(sortObj)[0] || ['activityDate', -1];
    this._data.sort((a, b) => {
      const valA = new Date(a[key] || 0).getTime();
      const valB = new Date(b[key] || 0).getTime();
      return dir === -1 ? valB - valA : valA - valB;
    });
    return this;
  }

  limit(num) {
    this._data = this._data.slice(0, num);
    return this;
  }

  lean() {
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this._data).then(resolve, reject);
  }
}

const ActivityFallback = {
  find(filter = {}, fields = '') {
    const all = loadFallbackData();
    let filtered = all;

    if (filter.activityType) {
      filtered = filtered.filter((a) => a.activityType === filter.activityType);
    }
    if (filter.activityDate && filter.activityDate.$gte) {
      const minDate = new Date(filter.activityDate.$gte).getTime();
      filtered = filtered.filter((a) => new Date(a.activityDate).getTime() >= minDate);
    }

    return new FallbackQuery(filtered);
  },

  async create(doc) {
    const all = loadFallbackData();
    const newDoc = {
      _id: crypto.randomBytes(12).toString('hex'), // 24-char hex matching ObjectId
      activityType: doc.activityType,
      activityDate: new Date(doc.activityDate).toISOString(),
      quantity: Number(doc.quantity),
      description: doc.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    all.push(newDoc);
    saveFallbackData(all);
    return newDoc;
  },

  async findById(id) {
    const all = loadFallbackData();
    const item = all.find((a) => a._id === id);
    return item || null;
  },

  async findByIdAndUpdate(id, updateData, options = {}) {
    const all = loadFallbackData();
    const idx = all.findIndex((a) => a._id === id);
    if (idx === -1) return null;

    const current = all[idx];
    const updated = {
      ...current,
      ...(updateData.activityType !== undefined && { activityType: updateData.activityType }),
      ...(updateData.activityDate !== undefined && { activityDate: new Date(updateData.activityDate).toISOString() }),
      ...(updateData.quantity !== undefined && { quantity: Number(updateData.quantity) }),
      ...(updateData.description !== undefined && { description: updateData.description }),
      updatedAt: new Date().toISOString()
    };
    all[idx] = updated;
    saveFallbackData(all);
    return options.new === false ? current : updated;
  },

  async findByIdAndDelete(id) {
    const all = loadFallbackData();
    const idx = all.findIndex((item) => item._id === id);
    if (idx === -1) return null;
    const [removed] = all.splice(idx, 1);
    saveFallbackData(all);
    return removed;
  },

  async countDocuments(filter = {}) {
    const all = loadFallbackData();
    if (filter.activityDate && filter.activityDate.$gte) {
      const minDate = new Date(filter.activityDate.$gte).getTime();
      return all.filter((a) => new Date(a.activityDate).getTime() >= minDate).length;
    }
    if (filter.activityType) {
      return all.filter((a) => a.activityType === filter.activityType).length;
    }
    return all.length;
  }
};

/**
 * Safely import existing JSON records into MongoDB Atlas without duplicating.
 * Preserves original IDs, dates, quantities, descriptions, and timestamps.
 * Idempotent: safe to run multiple times. Non-destructive to activities_store.json.
 */
async function migrateFallbackDataToMongo() {
  if (mongoose.connection.readyState !== 1) {
    return { migrated: 0, reason: 'mongo_not_connected' };
  }

  try {
    const records = loadFallbackData();
    if (!Array.isArray(records) || records.length === 0) {
      return { migrated: 0, reason: 'no_records_in_store' };
    }

    let insertedCount = 0;
    let existingCount = 0;

    for (const r of records) {
      const doc = {
        activityType: r.activityType,
        activityDate: new Date(r.activityDate),
        quantity: Number(r.quantity),
        description: r.description || ''
      };

      let filter;
      if (r._id && /^[0-9a-fA-F]{24}$/.test(r._id)) {
        const objectId = new mongoose.Types.ObjectId(r._id);
        filter = { _id: objectId };
        doc._id = objectId;
      } else {
        filter = {
          activityType: r.activityType,
          activityDate: new Date(r.activityDate),
          quantity: Number(r.quantity)
        };
      }

      if (r.createdAt) doc.createdAt = new Date(r.createdAt);
      if (r.updatedAt) doc.updatedAt = new Date(r.updatedAt);

      const result = await MongooseActivity.updateOne(
        filter,
        { $setOnInsert: doc },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        insertedCount++;
      } else {
        existingCount++;
      }
    }

    if (insertedCount > 0) {
      console.log(`✅ [Migration] Safely imported ${insertedCount} existing activity records into MongoDB Atlas (${existingCount} already present).`);
    } else {
      console.log(`ℹ️ [Migration] All ${existingCount} JSON records are already present in MongoDB Atlas.`);
    }

    return { migrated: insertedCount, alreadyExisting: existingCount };
  } catch (err) {
    console.warn('⚠️ [Migration] Error during record import:', err.message);
    return { migrated: 0, error: err.message };
  }
}

/**
 * Unified Activity Data Access Layer.
 * Explicitly dispatches to Mongoose when connected or Fallback store when offline.
 * Avoids any Proxy constructor binding pitfalls.
 */
const Activity = {
  find(filter = {}, projection = null, options = {}) {
    if (mongoose.connection.readyState === 1) {
      return MongooseActivity.find(filter, projection, options);
    }
    return ActivityFallback.find(filter, projection);
  },

  async create(doc) {
    if (mongoose.connection.readyState === 1) {
      const instance = new MongooseActivity(doc);
      return await instance.save();
    }
    return await ActivityFallback.create(doc);
  },

  async findById(id) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseActivity.findById(id);
    }
    return await ActivityFallback.findById(id);
  },

  async findByIdAndUpdate(id, updateData, options = {}) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseActivity.findByIdAndUpdate(id, updateData, options);
    }
    return await ActivityFallback.findByIdAndUpdate(id, updateData, options);
  },

  async findByIdAndDelete(id) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseActivity.findByIdAndDelete(id);
    }
    return await ActivityFallback.findByIdAndDelete(id);
  },

  async countDocuments(filter = {}) {
    if (mongoose.connection.readyState === 1) {
      return await MongooseActivity.countDocuments(filter);
    }
    return await ActivityFallback.countDocuments(filter);
  }
};

module.exports = {
  Activity,
  MongooseActivity,
  ActivityFallback,
  migrateFallbackDataToMongo,
  loadFallbackData,
  ALLOWED_ACTIVITY_TYPES,
  DATA_FILE
};

