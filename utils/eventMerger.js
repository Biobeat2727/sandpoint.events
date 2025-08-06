const fs = require('fs-extra');
const path = require('path');
const { differenceInDays, parseISO, isValid, addDays } = require('date-fns');

class EventMerger {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.dataDir = path.join(this.baseDir, 'data', 'scraped-events');
    this.outputDir = path.join(this.baseDir, 'data', 'merged-events');
    this.duplicateThresholds = {
      titleSimilarity: 0.8,
      dateDifferenceHours: 2,
      venueSimilarity: 0.7
    };
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
  }

  async mergeAllEvents() {
    console.log('Starting event merge process...');
    
    // Load events from all scraped sources
    const allEvents = await this.loadAllScrapedEvents();
    
    if (allEvents.length === 0) {
      console.log('No events found to merge');
      return [];
    }

    console.log(`Loaded ${allEvents.length} events from all sources`);
    
    // Remove duplicates
    const uniqueEvents = await this.removeDuplicates(allEvents);
    console.log(`After deduplication: ${uniqueEvents.length} events`);
    
    // Filter and clean events
    const cleanedEvents = this.filterAndCleanEvents(uniqueEvents);
    console.log(`After filtering and cleaning: ${cleanedEvents.length} events`);
    
    // Sort by date
    const sortedEvents = this.sortEventsByDate(cleanedEvents);
    
    // Generate merged file
    const mergedFilename = `merged-events-${new Date().toISOString().split('T')[0]}.json`;
    await this.saveEvents(sortedEvents, mergedFilename);
    
    // Generate summary report
    await this.generateMergeReport(allEvents, sortedEvents);
    
    return sortedEvents;
  }

  async loadAllScrapedEvents() {
    const allEvents = [];
    
    try {
      // Check if scraped-events directory exists
      if (!(await fs.pathExists(this.dataDir))) {
        console.warn('Scraped events directory not found');
        return [];
      }
      
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      console.log(`Found ${jsonFiles.length} scraped event files`);
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.dataDir, file);
          const events = await fs.readJson(filePath);
          
          if (Array.isArray(events)) {
            console.log(`Loaded ${events.length} events from ${file}`);
            allEvents.push(...events);
          } else {
            console.warn(`Invalid format in ${file}: expected array`);
          }
        } catch (error) {
          console.error(`Error loading ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error loading scraped events:', error.message);
    }
    
    return allEvents;
  }

  async removeDuplicates(events) {
    console.log('Removing duplicates...');
    
    const uniqueEvents = [];
    const duplicates = [];
    
    for (let i = 0; i < events.length; i++) {
      const currentEvent = events[i];
      let isDuplicate = false;
      
      // Check against already processed unique events
      for (let j = 0; j < uniqueEvents.length; j++) {
        const existingEvent = uniqueEvents[j];
        
        if (this.areEventsDuplicate(currentEvent, existingEvent)) {
          isDuplicate = true;
          
          // Choose the better event (more complete data)
          const betterEvent = this.chooseBetterEvent(currentEvent, existingEvent);
          uniqueEvents[j] = betterEvent;
          
          duplicates.push({
            kept: betterEvent.title,
            discarded: currentEvent.title === betterEvent.title ? existingEvent.title : currentEvent.title,
            reason: 'duplicate_detected'
          });
          
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueEvents.push(currentEvent);
      }
    }
    
    console.log(`Removed ${duplicates.length} duplicates`);
    
    // Save duplicate report
    if (duplicates.length > 0) {
      const duplicateReportPath = path.join(this.outputDir, 'duplicate-report.json');
      await fs.writeJson(duplicateReportPath, duplicates, { spaces: 2 });
    }
    
    return uniqueEvents;
  }

  areEventsDuplicate(event1, event2) {
    // Compare titles
    const titleSimilarity = this.calculateStringSimilarity(
      event1.title.toLowerCase(),
      event2.title.toLowerCase()
    );
    
    // Compare dates
    const date1 = parseISO(event1.date);
    const date2 = parseISO(event2.date);
    const dateDifference = Math.abs(differenceInDays(date1, date2));
    
    // Compare venues if available
    let venueSimilarity = 0;
    if (event1.venue && event2.venue) {
      venueSimilarity = this.calculateStringSimilarity(
        event1.venue.name || event1.venue,
        event2.venue.name || event2.venue
      );
    }
    
    // Determine if duplicate based on thresholds
    const isTitleSimilar = titleSimilarity >= this.duplicateThresholds.titleSimilarity;
    const isDateClose = dateDifference <= 1; // Within 1 day
    const isVenueSimilar = venueSimilarity >= this.duplicateThresholds.venueSimilarity || 
                          (!event1.venue || !event2.venue); // Similar venue or no venue info
    
    return isTitleSimilar && isDateClose && isVenueSimilar;
  }

  calculateStringSimilarity(str1, str2) {
    // Simple Jaccard similarity
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  chooseBetterEvent(event1, event2) {
    // Score events based on completeness
    const score1 = this.scoreEventCompleteness(event1);
    const score2 = this.scoreEventCompleteness(event2);
    
    return score1 >= score2 ? event1 : event2;
  }

  scoreEventCompleteness(event) {
    let score = 0;
    
    // Required fields
    if (event.title) score += 2;
    if (event.date) score += 2;
    
    // Desirable fields
    if (event.description && event.description.length > 50) score += 1;
    if (event.image) score += 1;
    if (event.venue) score += 1;
    if (event.url) score += 1;
    if (event.tags && event.tags.length > 2) score += 1;
    if (event.price) score += 0.5;
    if (event.tickets) score += 0.5;
    
    // Source reliability (prefer official sources)
    if (event.source && event.source.includes('City of Sandpoint')) score += 1;
    if (event.source && event.source.includes('Official')) score += 0.5;
    
    return score;
  }

  filterAndCleanEvents(events) {
    console.log('Filtering and cleaning events...');
    
    const now = new Date();
    const twoMonthsFromNow = addDays(now, 60);
    
    return events.filter(event => {
      try {
        // Must have title and date
        if (!event.title || !event.date) return false;
        
        // Date must be valid and in the future
        const eventDate = parseISO(event.date);
        if (!isValid(eventDate)) return false;
        if (eventDate < now) return false;
        if (eventDate > twoMonthsFromNow) return false; // Not too far in future
        
        // Title must be reasonable
        if (event.title.length < 3 || event.title.length > 200) return false;
        
        // Clean up the event data
        event.title = this.cleanTitle(event.title);
        event.description = this.cleanDescription(event.description);
        
        return true;
      } catch (error) {
        console.warn(`Filtering out invalid event: ${error.message}`);
        return false;
      }
    }).map(event => this.cleanEvent(event));
  }

  cleanTitle(title) {
    if (!title) return '';
    
    return title
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,!?()]/g, '')
      .trim()
      .substring(0, 150);
  }

  cleanDescription(description) {
    if (!description) return '';
    
    return description
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,!?()]/g, '')
      .trim()
      .substring(0, 500);
  }

  cleanEvent(event) {
    // Standardize venue format
    if (event.venue && typeof event.venue === 'string') {
      event.venue = { name: event.venue };
    }
    
    // Ensure tags are clean
    if (event.tags) {
      event.tags = event.tags
        .filter(tag => tag && typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }
    
    // Clean up URLs
    if (event.url && !event.url.startsWith('http')) {
      delete event.url;
    }
    
    if (event.tickets && !event.tickets.startsWith('http')) {
      delete event.tickets;
    }
    
    if (event.image && !event.image.startsWith('http')) {
      delete event.image;
    }
    
    return event;
  }

  sortEventsByDate(events) {
    return events.sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA - dateB;
    });
  }

  async saveEvents(events, filename) {
    const filepath = path.join(this.outputDir, filename);
    await fs.writeJson(filepath, events, { spaces: 2 });
    console.log(`Saved ${events.length} merged events to ${filepath}`);
    
    // Also save as events.json for easy access
    const mainFilepath = path.join(this.outputDir, 'events.json');
    await fs.writeJson(mainFilepath, events, { spaces: 2 });
    console.log(`Also saved as ${mainFilepath}`);
    
    return filepath;
  }

  async generateMergeReport(originalEvents, mergedEvents) {
    const report = {
      timestamp: new Date().toISOString(),
      original_count: originalEvents.length,
      merged_count: mergedEvents.length,
      duplicates_removed: originalEvents.length - mergedEvents.length,
      sources: {},
      date_range: {
        earliest: null,
        latest: null
      },
      venues: {},
      tags: {}
    };

    // Analyze sources
    originalEvents.forEach(event => {
      const source = event.source || 'Unknown';
      report.sources[source] = (report.sources[source] || 0) + 1;
    });

    // Analyze merged events
    mergedEvents.forEach(event => {
      // Date range
      const eventDate = parseISO(event.date);
      if (!report.date_range.earliest || eventDate < parseISO(report.date_range.earliest)) {
        report.date_range.earliest = event.date;
      }
      if (!report.date_range.latest || eventDate > parseISO(report.date_range.latest)) {
        report.date_range.latest = event.date;
      }

      // Venues
      const venue = event.venue?.name || event.venue || 'Unknown';
      report.venues[venue] = (report.venues[venue] || 0) + 1;

      // Tags
      if (event.tags) {
        event.tags.forEach(tag => {
          report.tags[tag] = (report.tags[tag] || 0) + 1;
        });
      }
    });

    const reportPath = path.join(this.outputDir, 'merge-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`Merge report saved to ${reportPath}`);

    // Print summary
    console.log('\n--- MERGE SUMMARY ---');
    console.log(`Original events: ${report.original_count}`);
    console.log(`Merged events: ${report.merged_count}`);
    console.log(`Duplicates removed: ${report.duplicates_removed}`);
    console.log(`Date range: ${report.date_range.earliest} to ${report.date_range.latest}`);
    console.log(`Sources:`, Object.keys(report.sources).map(s => `${s}: ${report.sources[s]}`).join(', '));
    console.log('--- END SUMMARY ---\n');

    return report;
  }

  // Load the latest merged events
  async loadMergedEvents() {
    const eventsPath = path.join(this.outputDir, 'events.json');
    
    if (await fs.pathExists(eventsPath)) {
      return await fs.readJson(eventsPath);
    }
    
    return [];
  }
}

module.exports = EventMerger;