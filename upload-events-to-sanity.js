#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const SanityUploader = require('./utils/sanityUploader');
const { validateEventBatch, logValidationReport } = require('./utils/timeValidator');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envData = fs.readFileSync(envPath, 'utf8');
    const lines = envData.split('\n');
    lines.forEach(line => {
      line = line.trim();
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        return;
      }
      // Find the first = sign
      const equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        const key = line.substring(0, equalIndex).trim();
        const value = line.substring(equalIndex + 1).trim();
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

// Sanity configuration check
const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID;
const SANITY_DATASET = process.env.SANITY_DATASET || 'production';
const SANITY_TOKEN = process.env.SANITY_TOKEN;

if (!SANITY_PROJECT_ID || !SANITY_TOKEN) {
  console.error('❌ Missing required Sanity configuration. Please set SANITY_PROJECT_ID and SANITY_TOKEN in .env.local');
  process.exit(1);
}

/**
 * Main upload function using the proper SanityUploader
 */
async function uploadEvents() {
  try {
    console.log('🚀 Starting event upload to Sanity with proper venue handling...\n');

    // Load events from JSON file
    const eventsFilePath = path.join(__dirname, 'data', 'merged-events', 'events.json');
    console.log(`📄 Loading events from: ${eventsFilePath}`);

    if (!fs.existsSync(eventsFilePath)) {
      throw new Error(`Events file not found: ${eventsFilePath}`);
    }

    const eventsData = JSON.parse(fs.readFileSync(eventsFilePath, 'utf8'));
    console.log(`📊 Found ${eventsData.length} events to process\n`);

    // Validate time data before upload
    console.log('🕐 Validating event time data...');
    const validationReport = validateEventBatch(eventsData);
    logValidationReport(validationReport);

    if (!validationReport.isValid) {
      console.log('\n❌ Time validation failed. Please fix errors before uploading.');
      console.log('💡 Tip: Check the event processing pipeline for date/time parsing issues.');
      process.exit(1);
    }

    // Use validated events for upload
    const validatedEvents = validationReport.summary.validatedEvents;

    // Initialize the proper SanityUploader with venue support
    const uploader = new SanityUploader({
      baseDir: __dirname,
      projectId: process.env.SANITY_PROJECT_ID,
      dataset: process.env.SANITY_DATASET || 'production',
      token: process.env.SANITY_TOKEN,
      apiVersion: process.env.SANITY_API_VERSION || '2023-05-03'
    });

    // Upload events with full venue support - update existing events to add venue references
    const results = await uploader.uploadEvents(validatedEvents, {
      skipDuplicates: true,
      updateExisting: true, // Update existing events to add venue references
      createVenues: true // This ensures venues are created as proper references
    });

    return results;

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the upload
if (require.main === module) {
  uploadEvents();
}

module.exports = { uploadEvents };