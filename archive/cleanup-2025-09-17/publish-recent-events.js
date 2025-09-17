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

async function publishRecentEvents() {
  try {
    console.log('📰 Publishing recent events from today...\n');

    // Get recent draft events from today
    const draftEventsQuery = `*[_type == 'event' && _createdAt > "2025-09-16" && published != true] {
      _id,
      title,
      "slug": slug.current,
      published,
      image,
      _createdAt
    }`;

    const url = `${SANITY_BASE_URL}/query/${SANITY_DATASET}?query=${encodeURIComponent(draftEventsQuery)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SANITY_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to query draft events: ${response.statusText}`);
    }

    const data = await response.json();
    const draftEvents = data.result;

    console.log(`📋 Found ${draftEvents.length} recent draft events\n`);

    if (draftEvents.length === 0) {
      console.log('✅ No draft events to publish!');
      return;
    }

    console.log('📋 Events to publish:');
    draftEvents.forEach((event, index) => {
      const hasImage = event.image ? '🖼️' : '📝';
      console.log(`   ${index + 1}. "${event.title}" ${hasImage} (slug: ${event.slug})`);
    });

    console.log('\n🚀 Publishing events...');

    // Publish all these events
    const mutations = draftEvents.map(event => ({
      patch: {
        id: event._id,
        set: {
          published: true
        }
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
      throw new Error(`Failed to publish events: ${mutateResponse.statusText}\n${errorData}`);
    }

    const result = await mutateResponse.json();
    console.log(`✅ Successfully published ${draftEvents.length} events!`);

    console.log('\n📋 Published events:');
    draftEvents.forEach((event, index) => {
      console.log(`   ✅ "${event.title}" is now live at /events/${event.slug}`);
    });

    console.log('\n🎉 All recent events are now published and accessible on your website!');
    console.log('💡 Note: Events without images are now published but may benefit from image enhancement later.');

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the publish
publishRecentEvents();