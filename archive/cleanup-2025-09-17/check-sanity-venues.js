#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envData = fs.readFileSync(envPath, 'utf8');
    const lines = envData.split('\n');
    lines.forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) {
        return;
      }
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

const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID;
const SANITY_DATASET = process.env.SANITY_DATASET || 'production';
const SANITY_TOKEN = process.env.SANITY_TOKEN;
const SANITY_API_VERSION = process.env.SANITY_API_VERSION || '2025-05-23';

const SANITY_BASE_URL = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data`;

async function checkVenueStatus() {
  try {
    console.log('🔍 Checking venue status for recent events...\n');

    // Query for events from today (our recent uploads)
    const query = `*[_type == 'event' && _createdAt > "2025-09-16"] | order(_createdAt desc) {
      _id,
      _createdAt,
      title,
      slug,
      venue->{_id, name, address},
      locationNote,
      published
    }`;

    const url = `${SANITY_BASE_URL}/query/${SANITY_DATASET}?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SANITY_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to query events: ${response.statusText}`);
    }

    const data = await response.json();
    const events = data.result;

    console.log(`📋 Found ${events.length} events from today:\n`);

    events.forEach((event, index) => {
      console.log(`${index + 1}. "${event.title}"`);
      console.log(`   ID: ${event._id}`);
      console.log(`   Created: ${event._createdAt}`);

      if (event.venue && event.venue.name) {
        console.log(`   ✅ Venue Reference: ${event.venue.name} (ID: ${event.venue._id})`);
        if (event.venue.address) {
          console.log(`   📍 Address: ${event.venue.address}`);
        }
      } else if (event.locationNote) {
        console.log(`   ⚠️  Location Note: ${event.locationNote} (no venue reference)`);
      } else {
        console.log(`   ❌ No venue data`);
      }
      console.log('');
    });

    // Summary
    const withVenueRef = events.filter(e => e.venue && e.venue._id).length;
    const withLocationNote = events.filter(e => !e.venue && e.locationNote).length;
    const withoutVenue = events.filter(e => !e.venue && !e.locationNote).length;

    console.log('📊 Summary:');
    console.log(`   ✅ Events with venue references: ${withVenueRef}`);
    console.log(`   ⚠️  Events with only locationNote: ${withLocationNote}`);
    console.log(`   ❌ Events without venue data: ${withoutVenue}`);

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the check
checkVenueStatus();