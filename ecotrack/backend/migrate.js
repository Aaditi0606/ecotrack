/**
 * EcoTrack - Standalone Data Migration CLI Script
 * Safely imports existing JSON activity records into MongoDB Atlas without duplicates.
 * Preserves original IDs, dates, quantities, and descriptions.
 * Non-destructive: activities_store.json is never deleted or modified.
 *
 * Usage:
 *   node migrate.js
 *   npm run migrate
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from parent and current directories
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const {
  MongooseActivity,
  migrateFallbackDataToMongo,
  loadFallbackData
} = require('./models/Activity');

function maskMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  try {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/, '$1*****$3');
  } catch {
    return 'mongodb://[credentials masked]';
  }
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecotrack';

async function runMigration() {
  console.log('=============================================================');
  console.log('🌿 EcoTrack - MongoDB Atlas Safe Data Migration Utility');
  console.log('=============================================================');

  const masked = maskMongoUri(MONGODB_URI);
  console.log(`[Migration] Target Database URI: ${masked}`);

  const localRecords = loadFallbackData();
  console.log(`[Migration] Discovered ${localRecords.length} records in local JSON store.`);

  if (localRecords.length === 0) {
    console.log('ℹ️ [Migration] No records found in activities_store.json to migrate.');
    process.exit(0);
  }

  try {
    console.log('[Migration] Connecting to MongoDB Atlas (timeout: 30s)...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000
    });
    console.log('✅ [Migration] Connected successfully to live MongoDB instance.');

    const beforeCount = await MongooseActivity.countDocuments();
    console.log(`[Migration] Current documents in MongoDB 'activities' collection: ${beforeCount}`);

    const result = await migrateFallbackDataToMongo();
    const afterCount = await MongooseActivity.countDocuments();

    console.log('\n---------------- Migration Summary ----------------');
    console.log(`  - Newly Imported:     ${result.migrated}`);
    console.log(`  - Already Existed:    ${result.skipped || result.alreadyExisting || 0}`);
    console.log(`  - Errors:             ${result.errors || 0}`);
    console.log(`  - Total in Database:  ${afterCount}`);
    console.log('---------------------------------------------------');
    console.log('✅ Migration process completed cleanly.\n');
  } catch (err) {
    console.error('❌ [Migration] Failed to execute migration:', err.message);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('[Migration] Disconnected from database.');
    } catch { }
  }
}

runMigration();
