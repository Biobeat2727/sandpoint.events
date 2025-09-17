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

async function checkPublishedEvents() {
  try {
    console.log('🔍 Checking published events in Sanity...\n');

    // Check all events
    const allEventsQuery = `*[_type == 'event'] {
      _id,
      title,
      slug,
      published,
      _createdAt
    }`;

    const allEventsUrl = `${SANITY_BASE_URL}/query/${SANITY_DATASET}?query=${encodeURIComponent(allEventsQuery)}`;

    const allEventsResponse = await fetch(allEventsUrl, {
      headers: {
        'Authorization': `Bearer ${SANITY_TOKEN}`
      }
    });

    if (!allEventsResponse.ok) {
      throw new Error(`Failed to query all events: ${allEventsResponse.statusText}`);
    }

    const allEventsData = await allEventsResponse.json();
    const allEvents = allEventsData.result;

    console.log(`📊 Total events in Sanity: ${allEvents.length}\n`);

    // Check published events
    const publishedEventsQuery = `*[_type == 'event' && published == true] {
      _id,
      title,
      "slug": slug.current,
      published,
      _createdAt
    }`;

    const publishedEventsUrl = `${SANITY_BASE_URL}/query/${SANITY_DATASET}?query=${encodeURIComponent(publishedEventsQuery)}`;

    const publishedEventsResponse = await fetch(publishedEventsUrl, {
      headers: {
        'Authorization': `Bearer ${SANITY_TOKEN}`
      }
    });

    if (!publishedEventsResponse.ok) {
      throw new Error(`Failed to query published events: ${publishedEventsResponse.statusText}`);
    }

    const publishedEventsData = await publishedEventsResponse.json();
    const publishedEvents = publishedEventsData.result;

    console.log(`✅ Published events: ${publishedEvents.length}`);
    console.log(`📋 Draft events: ${allEvents.length - publishedEvents.length}\n`);

    if (publishedEvents.length > 0) {
      console.log('📋 Published events list:');
      publishedEvents.slice(0, 10).forEach((event, index) => {
        console.log(`   ${index + 1}. "${event.title}" (slug: ${event.slug})`);
      });

      if (publishedEvents.length > 10) {
        console.log(`   ... and ${publishedEvents.length - 10} more`);
      }
    } else {
      console.log('⚠️  No published events found!');
      console.log('This means all events are saved as drafts, which explains the 404s.');
    }

    console.log('\n📋 Recent events (published status):');
    allEvents
      .filter(e => e._createdAt > '2025-09-16')
      .slice(0, 5)
      .forEach((event, index) => {
        const status = event.published ? '✅ Published' : '📝 Draft';
        console.log(`   ${index + 1}. "${event.title}" - ${status}`);
      });

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the check
checkPublishedEvents();