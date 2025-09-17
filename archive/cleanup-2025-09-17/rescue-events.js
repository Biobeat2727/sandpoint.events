#!/usr/bin/env node

/**
 * Event Data Rescue Script
 *
 * Automatically salvages incomplete or problematic events from the review queue
 * and promotes them to production-ready status through intelligent reasoning
 * and data completion.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { format, parseISO } = require('date-fns');

class EventRescuer {
  constructor() {
    this.rescuedEvents = [];
    this.stillNeedsReview = [];
    this.unfixableEvents = [];
    this.rescueStats = {
      totalProcessed: 0,
      rescued: 0,
      stillReview: 0,
      unfixable: 0,
      fixTypes: {
        dateFixed: 0,
        venueFixed: 0,
        titleCleaned: 0,
        timesAdded: 0,
        tagsImproved: 0,
        descriptionCleaned: 0
      }
    };
  }

  // Known venue database from eventMerger.js
  getKnownVenues() {
    return {
      'panida theater': {
        name: 'Panida Theater',
        address: '300 N 1st Ave, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 263-9191',
        website: 'https://www.panida.org'
      },
      'schweitzer mountain resort': {
        name: 'Schweitzer Mountain Resort',
        address: '10000 Schweitzer Mountain Rd, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 263-9555',
        website: 'https://www.schweitzer.com'
      },
      'the tervan': {
        name: 'The Tervan',
        address: '411 Cedar St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 610-4988',
        website: 'https://www.thetervan.com'
      },
      'connie\'s lounge': {
        name: 'Connie\'s Lounge',
        address: '323 Cedar St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 263-9391',
        website: ''
      },
      'pend d\'oreille winery': {
        name: 'Pend d\'Oreille Winery',
        address: '301 Cedar St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 265-8545',
        website: 'https://www.pendoreillefinery.com'
      },
      'barrel 33': {
        name: 'Barrel 33',
        address: '100 N. First Ave, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 610-4850',
        website: 'https://www.barrel33.com'
      },
      'evans brothers coffee': {
        name: 'Evans Brothers Coffee',
        address: '524 Church St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 265-6027',
        website: 'https://www.evansbroscoffee.com'
      },
      'the hive': {
        name: 'The Hive',
        address: '207 N 1st Ave, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 610-4005',
        website: 'https://www.thehivesandpoint.com'
      },
      'smokesmith bbq': {
        name: 'Smokesmith BBQ',
        address: '102 S Boyer Ave, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 255-7675',
        website: 'https://www.smokesmithbbq.com'
      }
    };
  }

  // Real dates extracted from Schweitzer website
  getSchwitzerEventDates() {
    return {
      'feel-it-all': {
        date: '2025-10-02T19:00:00.000Z',
        startTime: '19:00',
        endTime: null,
        venue: 'panida theater'
      },
      'fall-pass-sale-deadline': {
        date: '2025-10-09T23:59:00.000Z',
        startTime: null,
        endTime: null,
        venue: 'schweitzer mountain resort'
      },
      'opening-day': {
        date: '2025-11-21T09:00:00.000Z',
        startTime: '09:00',
        endTime: null,
        venue: 'schweitzer mountain resort'
      },
      'ski-with-santa': {
        date: '2025-12-23T09:00:00.000Z',
        startTime: '09:00',
        endTime: null,
        venue: 'schweitzer mountain resort'
      },
      'taps-new-years-eve': {
        date: '2025-12-31T21:00:00.000Z',
        startTime: '21:00',
        endTime: null,
        venue: 'schweitzer mountain resort'
      }
    };
  }

  rescueEvent(event) {
    const rescued = { ...event };
    let fixesApplied = [];

    console.log(`\n🔧 Attempting to rescue: "${event.title}"`);

    try {
      // Fix Schweitzer events with incorrect dates
      if (this.fixSchwitzerDates(rescued)) {
        fixesApplied.push('Fixed Schweitzer event date from website data');
        this.rescueStats.fixTypes.dateFixed++;
      }

      // Fix missing or incomplete venue data
      if (this.fixVenueData(rescued)) {
        fixesApplied.push('Enhanced venue information');
        this.rescueStats.fixTypes.venueFixed++;
      }

      // Clean up titles
      if (this.cleanTitle(rescued)) {
        fixesApplied.push('Cleaned title formatting');
        this.rescueStats.fixTypes.titleCleaned++;
      }

      // Clean up descriptions
      if (this.cleanDescription(rescued)) {
        fixesApplied.push('Improved description text');
        this.rescueStats.fixTypes.descriptionCleaned++;
      }

      // Add missing end times where they can be inferred
      if (this.addMissingEndTimes(rescued)) {
        fixesApplied.push('Added missing end times');
        this.rescueStats.fixTypes.timesAdded++;
      }

      // Improve tags based on content
      if (this.improveTags(rescued)) {
        fixesApplied.push('Enhanced event tags');
        this.rescueStats.fixTypes.tagsImproved++;
      }

      // Validate if event is now production-ready
      const validationResult = this.validateEvent(rescued);

      if (validationResult.isValid) {
        rescued.needsReview = false;
        rescued.published = rescued.imageUrl ? true : false; // Published if has image

        console.log(`✅ RESCUED: ${fixesApplied.join(', ')}`);
        this.rescuedEvents.push(rescued);
        this.rescueStats.rescued++;
        return 'rescued';
      } else {
        console.log(`⚠️  STILL NEEDS REVIEW: ${validationResult.reason}`);
        this.stillNeedsReview.push({
          ...rescued,
          rescueAttempt: {
            fixesAttempted: fixesApplied,
            stillNeedsReview: validationResult.reason
          }
        });
        this.rescueStats.stillReview++;
        return 'review';
      }

    } catch (error) {
      console.log(`❌ UNFIXABLE: ${error.message}`);
      this.unfixableEvents.push({
        ...event,
        rescueError: error.message
      });
      this.rescueStats.unfixable++;
      return 'unfixable';
    }
  }

  fixSchwitzerDates(event) {
    const schwitzerDates = this.getSchwitzerEventDates();

    if (event.source === 'Schweitzer Mountain Resort' && event.url) {
      const slug = event.url.split('/').pop();
      const dateInfo = schwitzerDates[slug];

      if (dateInfo) {
        // Fix the placeholder date with real date
        event.date = dateInfo.date;
        event.startDate = dateInfo.date;

        if (dateInfo.startTime) {
          event.startTime = dateInfo.startTime;
        }

        if (dateInfo.endTime) {
          event.endTime = dateInfo.endTime;
        }

        // Fix venue if specified
        if (dateInfo.venue && dateInfo.venue !== 'schweitzer mountain resort') {
          const knownVenues = this.getKnownVenues();
          const venueData = knownVenues[dateInfo.venue];
          if (venueData) {
            event.venue = venueData;
          }
        }

        console.log(`  📅 Fixed date: ${dateInfo.date} (was placeholder)`);
        return true;
      }
    }
    return false;
  }

  fixVenueData(event) {
    const knownVenues = this.getKnownVenues();
    let fixed = false;

    // If venue is null, try to extract from description
    if (!event.venue && event.description) {
      const venueMatch = this.extractVenueFromDescription(event.description);
      if (venueMatch) {
        const venueData = knownVenues[venueMatch.toLowerCase()];
        if (venueData) {
          event.venue = venueData;
          console.log(`  🏢 Added missing venue: ${venueData.name}`);
          fixed = true;
        }
      }
    }

    // If venue exists but is incomplete, enrich it
    if (event.venue && event.venue.name) {
      const venueName = event.venue.name.toLowerCase();
      const enrichedVenue = knownVenues[venueName];

      if (enrichedVenue) {
        // Check if current venue is missing data that we can fill
        const currentVenue = event.venue;
        const needsEnrichment = !currentVenue.address || !currentVenue.phone ||
                              currentVenue.address.includes('Downtown Sandpoint');

        if (needsEnrichment) {
          event.venue = { ...enrichedVenue };
          console.log(`  🏢 Enriched venue data for: ${enrichedVenue.name}`);
          fixed = true;
        }
      }
    }

    return fixed;
  }

  extractVenueFromDescription(description) {
    const venuePatterns = [
      /at\s+([^,]+),\s*\d/i,
      /join\s+(?:at\s+)?([^,]+),\s*\d/i,
      /head\s+(?:down\s+)?to\s+([^,]+),\s*\d/i,
      /get\s+over\s+to\s+(?:the\s+)?([^,]+),\s*\d/i
    ];

    for (const pattern of venuePatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  cleanTitle(event) {
    let cleaned = false;
    const originalTitle = event.title;

    // Fix common title issues
    event.title = event.title
      .replace(/\s+/g, ' ') // Multiple spaces
      .replace(/&amp;/g, '&') // HTML entities
      .trim();

    // Fix specific issues seen in data
    if (event.title.includes(' or ')) {
      event.title = event.title.replace(' or ', ' for ');
      cleaned = true;
    }

    if (event.title !== originalTitle) {
      console.log(`  📝 Cleaned title: "${originalTitle}" → "${event.title}"`);
      cleaned = true;
    }

    return cleaned;
  }

  cleanDescription(event) {
    let cleaned = false;
    const originalDesc = event.description;

    if (event.description) {
      // Fix common description issues
      event.description = event.description
        .replace(/\s+/g, ' ') // Multiple spaces
        .replace(/\.\s*\./g, '.') // Double periods
        .replace(/(\d)\s*p\.m\./gi, '$1 p.m.') // Fix p.m. spacing
        .replace(/(\d)\s*a\.m\./gi, '$1 a.m.') // Fix a.m. spacing
        .replace(/\s*\$\s*(\d+)/g, ' $$$1') // Fix price formatting
        .replace(/Itll/g, 'It\'ll') // Fix contractions
        .replace(/nice of/g, 'night of') // Fix common typos
        .trim();

      if (event.description !== originalDesc) {
        console.log(`  📄 Cleaned description text`);
        cleaned = true;
      }
    }

    return cleaned;
  }

  addMissingEndTimes(event) {
    if (event.startTime && !event.endTime) {
      // Infer end times based on event type and start time
      const eventType = this.inferEventType(event);
      const startHour = parseInt(event.startTime.split(':')[0]);

      let endTime = null;

      switch (eventType) {
        case 'trivia':
        case 'bingo':
          endTime = this.addHours(event.startTime, 2); // 2 hour duration
          break;
        case 'music':
        case 'performance':
          endTime = this.addHours(event.startTime, 3); // 3 hour duration
          break;
        case 'class':
        case 'lesson':
          endTime = this.addHours(event.startTime, 2); // 2 hour duration
          break;
        case 'reception':
        case 'art':
          endTime = this.addHours(event.startTime, 2); // 2 hour duration
          break;
        default:
          // Don't guess for unknown event types
          return false;
      }

      if (endTime) {
        event.endTime = endTime;
        console.log(`  ⏰ Added end time: ${endTime} (inferred from ${eventType})`);
        return true;
      }
    }
    return false;
  }

  addHours(timeString, hours) {
    const [hour, minute] = timeString.split(':').map(Number);
    const newHour = (hour + hours) % 24;
    return `${newHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  inferEventType(event) {
    const text = `${event.title} ${event.description}`.toLowerCase();

    if (text.includes('trivia')) return 'trivia';
    if (text.includes('bingo')) return 'bingo';
    if (text.includes('music') || text.includes('band') || text.includes('jazz')) return 'music';
    if (text.includes('comedy') || text.includes('theater')) return 'performance';
    if (text.includes('lesson') || text.includes('dancing')) return 'class';
    if (text.includes('reception') || text.includes('artist')) return 'reception';
    if (text.includes('art') || text.includes('paint')) return 'art';

    return 'unknown';
  }

  improveTags(event) {
    let improved = false;
    const currentTags = new Set(event.tags || []);
    const originalSize = currentTags.size;

    // Add tags based on content analysis
    const text = `${event.title} ${event.description}`.toLowerCase();

    // Music-related tags
    if (text.match(/music|band|jazz|concert|perform|vocals|guitar|blues/)) {
      currentTags.add('music');
    }

    // Art-related tags
    if (text.match(/art|paint|artist|reception|gallery|studio/)) {
      currentTags.add('art');
    }

    // Food/drink tags
    if (text.match(/food|restaurant|winery|coffee|bbq|beverage/)) {
      currentTags.add('food');
    }

    // Performance tags
    if (text.match(/comedy|theater|performance|show|stage/)) {
      currentTags.add('performance');
    }

    // Family tags
    if (text.match(/family|kids|children|santa|youth/)) {
      currentTags.add('family');
    }

    // Fundraiser tags
    if (text.match(/charity|fundraiser|scholarship|raffle/)) {
      currentTags.add('fundraiser');
    }

    // Nightlife tags
    if (text.match(/21\+|lounge|bar|trivia|bingo|night/)) {
      currentTags.add('nightlife');
    }

    event.tags = Array.from(currentTags);

    if (event.tags.length > originalSize) {
      console.log(`  🏷️  Added tags: ${event.tags.slice(originalSize).join(', ')}`);
      improved = true;
    }

    return improved;
  }

  validateEvent(event) {
    // Check for critical missing information
    if (!event.title || event.title.trim().length === 0) {
      return { isValid: false, reason: 'Missing or empty title' };
    }

    if (!event.startDate) {
      return { isValid: false, reason: 'Missing start date' };
    }

    // Check if date is still a placeholder (from current scraping session)
    if (event.startDate.includes('2025-09-16T22:24:')) {
      return { isValid: false, reason: 'Still has placeholder date - needs real event date' };
    }

    if (!event.venue && !event.locationNote) {
      return { isValid: false, reason: 'Missing venue and location information' };
    }

    // Check for Newport events (outside Sandpoint)
    if (event.description && event.description.toLowerCase().includes('newport')) {
      return { isValid: false, reason: 'Event in Newport - outside Sandpoint coverage area' };
    }

    // Check for ambiguous venue names
    if (event.venue && event.venue.name &&
        (event.venue.name.includes('create arts') || event.venue.name === 'the Create Arts')) {
      return { isValid: false, reason: 'Ambiguous venue name needs clarification' };
    }

    // Event is valid for production
    return { isValid: true };
  }

  async rescueAllEvents() {
    console.log('🚑 Starting Event Rescue Operation...\n');

    // Load events to review
    const reviewPath = path.join(__dirname, 'data', 'events-to-review.json');
    const eventsToReview = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));

    this.rescueStats.totalProcessed = eventsToReview.length;
    console.log(`📋 Found ${eventsToReview.length} events in review queue\n`);

    // Process each event
    for (const event of eventsToReview) {
      this.rescueEvent(event);
    }

    // Generate report
    this.generateReport();

    // Update data files
    await this.updateDataFiles();

    console.log('\n🎉 Event rescue operation completed!');
    return this.rescueStats;
  }

  generateReport() {
    const stats = this.rescueStats;
    const successRate = ((stats.rescued / stats.totalProcessed) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 EVENT RESCUE OPERATION REPORT');
    console.log('='.repeat(60));
    console.log(`📝 Total events processed: ${stats.totalProcessed}`);
    console.log(`✅ Events rescued: ${stats.rescued} (${successRate}%)`);
    console.log(`⚠️  Still need review: ${stats.stillReview}`);
    console.log(`❌ Unfixable events: ${stats.unfixable}`);
    console.log('\n📈 FIX TYPES APPLIED:');
    console.log(`  📅 Dates fixed: ${stats.fixTypes.dateFixed}`);
    console.log(`  🏢 Venues fixed: ${stats.fixTypes.venueFixed}`);
    console.log(`  📝 Titles cleaned: ${stats.fixTypes.titleCleaned}`);
    console.log(`  📄 Descriptions cleaned: ${stats.fixTypes.descriptionCleaned}`);
    console.log(`  ⏰ Times added: ${stats.fixTypes.timesAdded}`);
    console.log(`  🏷️  Tags improved: ${stats.fixTypes.tagsImproved}`);

    if (this.rescuedEvents.length > 0) {
      console.log('\n✅ RESCUED EVENTS:');
      this.rescuedEvents.forEach(event => {
        console.log(`  • ${event.title} (${event.startDate?.split('T')[0]})`);
      });
    }

    if (this.stillNeedsReview.length > 0) {
      console.log('\n⚠️  EVENTS STILL NEEDING REVIEW:');
      this.stillNeedsReview.forEach(event => {
        const reason = event.rescueAttempt?.stillNeedsReview || 'Unknown reason';
        console.log(`  • ${event.title}: ${reason}`);
      });
    }

    console.log('='.repeat(60));
  }

  async updateDataFiles() {
    console.log('\n💾 Updating data files...');

    // Load current production events
    const eventsPath = path.join(__dirname, 'data', 'merged-events', 'events.json');
    let productionEvents = [];

    try {
      productionEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    } catch (error) {
      console.log('  📄 Creating new production events file');
    }

    // Add rescued events to production
    if (this.rescuedEvents.length > 0) {
      productionEvents.push(...this.rescuedEvents);
      fs.writeFileSync(eventsPath, JSON.stringify(productionEvents, null, 2));
      console.log(`  ✅ Added ${this.rescuedEvents.length} rescued events to production`);
    }

    // Update review queue with remaining events
    const reviewPath = path.join(__dirname, 'data', 'events-to-review.json');
    const remainingReviewEvents = this.stillNeedsReview.concat(this.unfixableEvents);

    fs.writeFileSync(reviewPath, JSON.stringify(remainingReviewEvents, null, 2));
    console.log(`  📝 Updated review queue: ${remainingReviewEvents.length} events remaining`);

    // Save rescue report
    const reportPath = path.join(__dirname, 'data', 'event-rescue-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.rescueStats,
      rescuedEvents: this.rescuedEvents.map(e => ({ id: e.id, title: e.title })),
      stillNeedsReview: this.stillNeedsReview.map(e => ({
        id: e.id,
        title: e.title,
        reason: e.rescueAttempt?.stillNeedsReview
      })),
      unfixableEvents: this.unfixableEvents.map(e => ({
        id: e.id,
        title: e.title,
        error: e.rescueError
      }))
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  📊 Saved rescue report to: ${reportPath}`);
  }
}

// Run the rescue operation
if (require.main === module) {
  const rescuer = new EventRescuer();
  rescuer.rescueAllEvents().catch(console.error);
}

module.exports = EventRescuer;