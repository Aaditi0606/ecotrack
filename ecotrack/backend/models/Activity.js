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

// Activity proxy dynamically delegates to Mongoose when connected, or Fallback when disconnected
const Activity = new Proxy(
  {},
  {
    get(target, prop) {
      if (mongoose.connection.readyState === 1) {
        return MongooseActivity[prop];
      }
      return ActivityFallback[prop];
    }
  }
);

module.exports = {
  Activity,
  MongooseActivity,
  ALLOWED_ACTIVITY_TYPES
};
