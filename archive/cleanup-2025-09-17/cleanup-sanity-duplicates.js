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

if (!SANITY_PROJECT_ID || !SANITY_TOKEN) {
  console.error('❌ Missing required Sanity configuration');
  process.exit(1);
}

const SANITY_BASE_URL = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data`;

/**
 * Query Sanity for all events
 */
async function getAllEvents() {
  const query = `*[_type == 'event'] | order(_createdAt desc) {
    _id,
    _createdAt,
    title,
    slug,
    date,
    startDate,
    venue->{_id, name},
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
  return data.result;
}

/**
 * Delete events by ID
 */
async function deleteEvents(eventIds) {
  const mutations = eventIds.map(id => ({
    delete: { id }
  }));

  const url = `${SANITY_BASE_URL}/mutate/${SANITY_DATASET}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SANITY_TOKEN}`
    },
    body: JSON.stringify({ mutations })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to delete events: ${response.statusText}\n${errorData}`);
  }

  return await response.json();
}

/**
 * Update event with venue reference
 */
async function updateEventVenue(eventId, venueId) {
  const mutation = {
    patch: {
      id: eventId,
      set: {
        venue: {
          _type: 'reference',
          _ref: venueId
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

  return await response.json();
}

/**
 * Get all venues
 */
async function getAllVenues() {
  const query = `*[_type == 'venue'] {
    _id,
    name,
    slug
  }`;

  const url = `${SANITY_BASE_URL}/query/${SANITY_DATASET}?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${SANITY_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to query venues: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Main cleanup function
 */
async function cleanupDuplicates() {
  try {
    console.log('🧹 Starting Sanity duplicate cleanup...\n');

    // Get all events
    console.log('📋 Fetching all events from Sanity...');
    const allEvents = await getAllEvents();
    console.log(`Found ${allEvents.length} total events\n`);

    // Get all venues for reference mapping
    console.log('🏢 Fetching all venues...');
    const allVenues = await getAllVenues();
    console.log(`Found ${allVenues.length} venues\n`);

    // Create venue name to ID mapping
    const venueMap = {};
    allVenues.forEach(venue => {
      venueMap[venue.name] = venue._id;
    });

    // Group events by slug to find duplicates
    const eventGroups = {};
    allEvents.forEach(event => {
      const slug = event.slug?.current || event.slug;
      if (!eventGroups[slug]) {
        eventGroups[slug] = [];
      }
      eventGroups[slug].push(event);
    });

    // Find duplicates and identify which to keep/delete
    const toDelete = [];
    const toUpdate = [];

    console.log('🔍 Analyzing duplicates...\n');

    for (const [slug, events] of Object.entries(eventGroups)) {
      if (events.length > 1) {
        console.log(`📋 Found ${events.length} duplicates for "${events[0].title}"`);

        // Sort by creation date (oldest first)
        events.sort((a, b) => new Date(a._createdAt) - new Date(b._createdAt));

        // Keep the oldest (original), delete the rest
        const originalEvent = events[0];
        const duplicates = events.slice(1);

        console.log(`   ✅ Keeping original: ${originalEvent._id} (${originalEvent._createdAt})`);

        duplicates.forEach(duplicate => {
          console.log(`   🗑️  Marking for deletion: ${duplicate._id} (${duplicate._createdAt})`);
          toDelete.push(duplicate._id);
        });

        // If original has locationNote but no venue reference, try to fix it
        if (originalEvent.locationNote && !originalEvent.venue) {
          const venueId = venueMap[originalEvent.locationNote];
          if (venueId) {
            console.log(`   🔧 Will update original to use venue reference for "${originalEvent.locationNote}"`);
            toUpdate.push({
              eventId: originalEvent._id,
              venueId: venueId,
              venueName: originalEvent.locationNote
            });
          }
        }

        console.log('');
      }
    }

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   🗑️  Events to delete: ${toDelete.length}`);
    console.log(`   🔧 Events to update with venue references: ${toUpdate.length}\n`);

    if (toDelete.length === 0 && toUpdate.length === 0) {
      console.log('✅ No duplicates found and no venue updates needed!');
      return;
    }

    // Delete duplicates
    if (toDelete.length > 0) {
      console.log(`🗑️  Deleting ${toDelete.length} duplicate events...`);
      await deleteEvents(toDelete);
      console.log(`✅ Successfully deleted ${toDelete.length} duplicates\n`);
    }

    // Update originals with venue references
    if (toUpdate.length > 0) {
      console.log(`🔧 Updating ${toUpdate.length} events with venue references...`);
      for (const update of toUpdate) {
        try {
          await updateEventVenue(update.eventId, update.venueId);
          console.log(`   ✅ Updated "${update.venueName}" venue reference`);
        } catch (error) {
          console.log(`   ❌ Failed to update venue for ${update.eventId}: ${error.message}`);
        }
      }
      console.log('');
    }

    // Final verification
    console.log('📋 Verifying cleanup...');
    const finalEvents = await getAllEvents();
    console.log(`Final event count: ${finalEvents.length}`);

    // Check for remaining duplicates
    const finalGroups = {};
    finalEvents.forEach(event => {
      const slug = event.slug?.current || event.slug;
      if (!finalGroups[slug]) {
        finalGroups[slug] = [];
      }
      finalGroups[slug].push(event);
    });

    const remainingDuplicates = Object.values(finalGroups).filter(group => group.length > 1);
    if (remainingDuplicates.length === 0) {
      console.log('✅ No duplicates remaining!');
    } else {
      console.log(`⚠️  ${remainingDuplicates.length} duplicate groups still exist`);
    }

    console.log('\n🎉 Cleanup completed!');

  } catch (error) {
    console.error('💥 Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupDuplicates();
}

module.exports = { cleanupDuplicates };