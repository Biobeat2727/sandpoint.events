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

async function fixRemainingVenue() {
  try {
    console.log('🔧 Fixing the remaining venue reference...\n');

    // Get Connie's Lounge venue ID
    const venueQuery = `*[_type == 'venue' && name == "Connie's Lounge"][0] {
      _id,
      name
    }`;

    const venueUrl = `${SANITY_BASE_URL}/query/${SANITY_DATASET}?query=${encodeURIComponent(venueQuery)}`;

    const venueResponse = await fetch(venueUrl, {
      headers: {
        'Authorization': `Bearer ${SANITY_TOKEN}`
      }
    });

    if (!venueResponse.ok) {
      throw new Error(`Failed to query venue: ${venueResponse.statusText}`);
    }

    const venueData = await venueResponse.json();
    const conniesVenue = venueData.result;

    if (!conniesVenue) {
      throw new Error('Connie\'s Lounge venue not found');
    }

    console.log(`🏢 Found venue: ${conniesVenue.name} (ID: ${conniesVenue._id})`);

    // Update the Bells Brews event
    const eventId = 'event-710c6b36-27b6-4709-adc8-4a75af8159fe-1758062154171';

    const mutation = {
      patch: {
        id: eventId,
        set: {
          venue: {
            _type: 'reference',
            _ref: conniesVenue._id
          }
        },
        unset: ['locationNote'] // Remove the locationNote field
      }
    };

    const url = `${SANITY_BASE_URL}/mutate/${SANITY_DATASET}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANITY_TOKEN}`
      },
      body: JSON.stringify({ mutations: [mutation] })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to update event: ${response.statusText}\n${errorData}`);
    }

    const result = await response.json();
    console.log('✅ Successfully updated "Bells Brews with the Sandpoint Music Conservatory"');
    console.log(`   Now uses venue reference: ${conniesVenue.name}`);
    console.log('   Removed locationNote field');

    console.log('\n🎉 All venue references are now properly configured!');

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixRemainingVenue();