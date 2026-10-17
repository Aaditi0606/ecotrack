const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'ecotrack-secure-auth-secret-key-2026';

// --- Password Utility using native Node.js crypto (zero external dependencies) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

function generateToken(user) {
  const payload = {
    userId: user._id ? user._id.toString() : user.id,
    username: user.username,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(str).digest('base64url');
  return `${str}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [str, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(str).digest('base64url');
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Mongoose User Schema ---
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
      default: ''
    },
    passwordHash: {
      type: String,
      required: true
    },
    salt: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

userSchema.methods.verifyPassword = function (pwd) {
  return verifyPassword(pwd, this.salt, this.passwordHash);
};

const MongooseUser = mongoose.model('User', userSchema);

// --- Fallback JSON User Store (for offline resiliency) ---
const USERS_STORE_FILE = path.join(__dirname, '../data/users_store.json');

function loadFallbackUsers() {
  try {
    if (fs.existsSync(USERS_STORE_FILE)) {
      const raw = fs.readFileSync(USERS_STORE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[FallbackUserStore] Error loading users:', e.message);
  }
  return [];
}

function saveFallbackUsers(users) {
  try {
    const dir = path.dirname(USERS_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_STORE_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[FallbackUserStore] Error saving users:', e.message);
  }
}

const UserFallback = {
  async findOne({ username }) {
    const users = loadFallbackUsers();
    const clean = username.toLowerCase().trim();
    return users.find((u) => u.username.toLowerCase() === clean) || null;
  },

  async findById(id) {
    const users = loadFallbackUsers();
    return users.find((u) => u._id === id || u.id === id) || null;
  },

  async create({ username, password, displayName }) {
    const users = loadFallbackUsers();
    const cleanUsername = username.toLowerCase().trim();
    const existing = users.find((u) => u.username.toLowerCase() === cleanUsername);
    if (existing) {
      const err = new Error('Username already exists');
      err.code = 11000;
      throw err;
    }

    const { salt, hash } = hashPassword(password);
    const newUser = {
      _id: crypto.randomBytes(12).toString('hex'),
      username: cleanUsername,
      displayName: displayName || cleanUsername,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    saveFallbackUsers(users);
    return newUser;
  }
};

const User = {
  async findOne(query) {
    if (mongoose.connection.readyState === 1) {
      if (query.username) {
        return await MongooseUser.findOne({ username: query.username.toLowerCase().trim() });
      }
      return await MongooseUser.findOne(query);
    }
    return await UserFallback.findOne(query);
  },

  async findById(id) {
    if (mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      return await MongooseUser.findById(id);
    }
    return await UserFallback.findById(id);
  },

  async create({ username, password, displayName }) {
    const cleanUsername = username.toLowerCase().trim();
    if (mongoose.connection.readyState === 1) {
      const { salt, hash } = hashPassword(password);
      const user = new MongooseUser({
        username: cleanUsername,
        displayName: displayName || cleanUsername,
        passwordHash: hash,
        salt
      });
      return await user.save();
    }
    return await UserFallback.create({ username, password, displayName });
  }
};

module.exports = {
  User,
  MongooseUser,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken
};
