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

async function fixSanityTimes() {
  try {
    console.log('🕐 Fixing start times in Sanity events...\n');

    // Load source events to get correct time data
    console.log('📋 Loading source event data...');
    const eventsFilePath = path.join(__dirname, 'data', 'merged-events', 'events.json');
    const sourceEvents = JSON.parse(fs.readFileSync(eventsFilePath, 'utf8'));

    // Create a map of slugs to source events for easy lookup
    const sourceEventMap = {};
    sourceEvents.forEach(event => {
      sourceEventMap[event.slug] = event;
    });

    console.log(`Found ${sourceEvents.length} source events\n`);

    // Get events from Sanity that need fixing
    console.log('📋 Fetching events from Sanity...');
    const query = `*[_type == 'event' && _createdAt > "2025-09-16"] {
      _id,
      title,
      slug,
      date,
      startDate,
      startTime,
      endTime
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
    const sanityEvents = data.result;

    console.log(`Found ${sanityEvents.length} events in Sanity\n`);

    // Analyze and fix each event
    const updates = [];

    for (const sanityEvent of sanityEvents) {
      const slug = sanityEvent.slug?.current || sanityEvent.slug;
      const sourceEvent = sourceEventMap[slug];

      if (!sourceEvent) {
        console.log(`⚠️  No source data found for: ${sanityEvent.title}`);
        continue;
      }

      console.log(`🔍 Analyzing: "${sanityEvent.title}"`);
      console.log(`   Current Sanity data:`);
      console.log(`     date: ${sanityEvent.date}`);
      console.log(`     startDate: ${sanityEvent.startDate}`);
      console.log(`     startTime: ${sanityEvent.startTime}`);
      console.log(`     endTime: ${sanityEvent.endTime}`);

      console.log(`   Source data:`);
      console.log(`     date: ${sourceEvent.date}`);
      console.log(`     startDate: ${sourceEvent.startDate}`);
      console.log(`     startTime: ${sourceEvent.startTime}`);
      console.log(`     endTime: ${sourceEvent.endTime}`);

      // Build update object
      const updateFields = {};
      let needsUpdate = false;

      // Check and fix date fields
      if (sanityEvent.date !== sourceEvent.date) {
        updateFields.date = sourceEvent.date || sourceEvent.startDate;
        needsUpdate = true;
      }

      if (sanityEvent.startDate !== sourceEvent.startDate) {
        updateFields.startDate = sourceEvent.startDate || sourceEvent.date;
        needsUpdate = true;
      }

      if (sourceEvent.endDate && sanityEvent.endDate !== sourceEvent.endDate) {
        updateFields.endDate = sourceEvent.endDate;
        needsUpdate = true;
      }

      // Check and fix time fields
      if (sanityEvent.startTime !== sourceEvent.startTime) {
        updateFields.startTime = sourceEvent.startTime;
        needsUpdate = true;
      }

      if (sanityEvent.endTime !== sourceEvent.endTime) {
        updateFields.endTime = sourceEvent.endTime;
        needsUpdate = true;
      }

      // Add other missing fields
      if (sourceEvent.referenceUrl) {
        updateFields.referenceUrl = sourceEvent.referenceUrl;
        needsUpdate = true;
      }

      if (sourceEvent.needsReview !== undefined) {
        updateFields.needsReview = sourceEvent.needsReview;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`   🔧 Will update with:`, updateFields);
        updates.push({
          id: sanityEvent._id,
          fields: updateFields
        });
      } else {
        console.log(`   ✅ No updates needed`);
      }

      console.log('');
    }

    if (updates.length === 0) {
      console.log('✅ No events need time fixes!');
      return;
    }

    console.log(`\n🔧 Applying ${updates.length} updates to Sanity...\n`);

    // Apply updates in batches
    const batchSize = 5;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      const mutations = batch.map(update => ({
        patch: {
          id: update.id,
          set: update.fields
        }
      }));

      const mutateUrl = `${SANITY_BASE_URL}/mutate/${SANITY_DATASET}`;

      const mutateResponse = await fetch(mutateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SANITY_TOKEN}`
        },
        body: JSON.stringify({ mutations })
      });

      if (!mutateResponse.ok) {
        const errorData = await mutateResponse.text();
        throw new Error(`Failed to update batch: ${mutateResponse.statusText}\n${errorData}`);
      }

      console.log(`✅ Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(updates.length/batchSize)}`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n🎉 Successfully fixed ${updates.length} events!`);
    console.log('\nTime fields are now properly structured with:');
    console.log('  • startDate: Full date with time');
    console.log('  • startTime: Time in HH:mm format');
    console.log('  • endTime: End time in HH:mm format');
    console.log('  • endDate: End date if different from start date');

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixSanityTimes();