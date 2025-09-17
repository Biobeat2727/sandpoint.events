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

async function investigateTimeIssues() {
  try {
    console.log('🕐 Investigating start time issues...\n');

    // First, check the source data
    console.log('📋 1. Checking source event data...');
    const eventsFilePath = path.join(__dirname, 'data', 'merged-events', 'events.json');
    const sourceEvents = JSON.parse(fs.readFileSync(eventsFilePath, 'utf8'));

    console.log(`Found ${sourceEvents.length} source events\n`);

    console.log('📊 Source Event Time Analysis:');
    sourceEvents.slice(0, 5).forEach((event, index) => {
      console.log(`${index + 1}. "${event.title}"`);
      console.log(`   📅 date: ${event.date}`);
      console.log(`   📅 startDate: ${event.startDate}`);
      console.log(`   🕐 startTime: ${event.startTime}`);
      console.log(`   🕐 endTime: ${event.endTime}`);

      // Parse the date to see what time it shows
      if (event.date) {
        const dateObj = new Date(event.date);
        console.log(`   ⏰ Parsed time: ${dateObj.toLocaleTimeString()}`);
      }
      console.log('');
    });

    // Now check what's in Sanity
    console.log('\n📋 2. Checking Sanity uploaded data...');
    const query = `*[_type == 'event' && _createdAt > "2025-09-16"] | order(_createdAt desc) {
      _id,
      title,
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

    console.log('📊 Sanity Event Time Analysis:');
    sanityEvents.slice(0, 5).forEach((event, index) => {
      console.log(`${index + 1}. "${event.title}"`);
      console.log(`   📅 date: ${event.date}`);
      console.log(`   📅 startDate: ${event.startDate}`);
      console.log(`   🕐 startTime: ${event.startTime}`);
      console.log(`   🕐 endTime: ${event.endTime}`);

      // Parse the date to see what time it shows
      if (event.date) {
        const dateObj = new Date(event.date);
        console.log(`   ⏰ Parsed time: ${dateObj.toLocaleTimeString()}`);
      }
      console.log('');
    });

    // Analysis summary
    console.log('\n🔍 Analysis Summary:');

    // Check source events with midnight times
    const sourceMidnight = sourceEvents.filter(e => {
      if (!e.date) return false;
      const date = new Date(e.date);
      return date.getUTCHours() === 0 && date.getUTCMinutes() === 0;
    });

    console.log(`📊 Source events with midnight (00:00) dates: ${sourceMidnight.length}/${sourceEvents.length}`);

    // Check Sanity events with midnight times
    const sanityMidnight = sanityEvents.filter(e => {
      if (!e.date) return false;
      const date = new Date(e.date);
      return date.getUTCHours() === 0 && date.getUTCMinutes() === 0;
    });

    console.log(`📊 Sanity events with midnight (00:00) dates: ${sanityMidnight.length}/${sanityEvents.length}`);

    // Check events with proper startTime fields
    const sourceWithStartTime = sourceEvents.filter(e => e.startTime && e.startTime !== null);
    const sanityWithStartTime = sanityEvents.filter(e => e.startTime && e.startTime !== null);

    console.log(`📊 Source events with startTime field: ${sourceWithStartTime.length}/${sourceEvents.length}`);
    console.log(`📊 Sanity events with startTime field: ${sanityWithStartTime.length}/${sanityEvents.length}`);

    if (sourceMidnight.length > 0) {
      console.log('\n⚠️  Events with midnight timestamps in source:');
      sourceMidnight.slice(0, 3).forEach(event => {
        console.log(`   • "${event.title}" - startTime: ${event.startTime}, date: ${event.date}`);
      });
    }

    if (sanityMidnight.length > 0) {
      console.log('\n⚠️  Events with midnight timestamps in Sanity:');
      sanityMidnight.slice(0, 3).forEach(event => {
        console.log(`   • "${event.title}" - startTime: ${event.startTime}, date: ${event.date}`);
      });
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the investigation
investigateTimeIssues();