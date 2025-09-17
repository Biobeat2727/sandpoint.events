const fs = require('fs-extra');
const path = require('path');
const { differenceInDays, parseISO, isValid, addDays } = require('date-fns');
const EventNormalizer = require('./eventNormalizer');
const { validateEventBatch, logValidationReport } = require('./timeValidator');

class EventMerger {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.dataDir = path.join(this.baseDir, 'data', 'scraped-events'); // Legacy support
    this.activeDir = path.join(this.baseDir, 'data', 'active'); // NEW: Primary source  
    this.archiveDir = path.join(this.baseDir, 'data', 'archive'); // NEW: Historical storage
    this.latestDir = path.join(this.dataDir, 'latest'); // Legacy
    this.sessionsDir = path.join(this.dataDir, 'sessions'); // Legacy
    this.outputDir = path.join(this.baseDir, 'data', 'merged-events');
    this.reviewOutputDir = path.join(this.baseDir, 'data');
    this.duplicateThresholds = {
      titleSimilarity: 0.8,
      dateDifferenceHours: 2,
      venueSimilarity: 0.7
    };
    
    // Initialize normalizer
    this.normalizer = new EventNormalizer();
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.reviewOutputDir);
    fs.ensureDirSync(this.activeDir); // NEW: Create active directory
    fs.ensureDirSync(this.archiveDir); // NEW: Create archive directory
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
    
    // Normalize events (fix schema drift and data quality issues)
    const normalizedEvents = uniqueEvents.map(event => this.normalizer.normalizeEvent(event));
    console.log('Applied normalization to fix schema drift and data quality issues');
    
    // Filter and clean events
    const cleanedEvents = this.filterAndCleanEvents(normalizedEvents);
    console.log(`After filtering and cleaning: ${cleanedEvents.length} events`);
    
    // Sort by date
    const sortedEvents = this.sortEventsByDate(cleanedEvents);
    
    // Separate events that need review from production-ready events
    const { productionEvents, reviewEvents } = this.separateEventsForReview(sortedEvents);
    
    console.log(`Production ready: ${productionEvents.length}, Need review: ${reviewEvents.length}`);
    
    // Generate merged files
    const mergedFilename = `merged-events-${new Date().toISOString().split('T')[0]}.json`;
    await this.saveEvents(productionEvents, mergedFilename);
    await this.saveReviewEvents(reviewEvents);
    
    // Generate summary report
    await this.generateMergeReport(allEvents, productionEvents, reviewEvents);
    
    return { productionEvents, reviewEvents };
  }

  async loadAllScrapedEvents() {
    const allEvents = [];
    
    try {
      // NEW: Primary loading from active directory 
      if (await fs.pathExists(this.activeDir)) {
        console.log('Loading from active directory (streamlined architecture)...');
        const activeEvents = await this.loadFromActiveDirectory();
        allEvents.push(...activeEvents);
        console.log(`Loaded ${activeEvents.length} events from active directory`);
      } else {
        console.log('Active directory not found, falling back to legacy loading...');
      }
      
      // Legacy fallback: Load from old scattered structure
      if (allEvents.length === 0) {
        console.log('Loading from legacy directories...');
        const legacyEvents = await this.loadFromLegacyStructure();
        allEvents.push(...legacyEvents);
        console.log(`Loaded ${legacyEvents.length} events from legacy structure`);
      }
      
      console.log(`Total events loaded: ${allEvents.length}`);
      
    } catch (error) {
      console.error('Error loading scraped events:', error.message);
    }
    
    return allEvents;
  }

  async loadFromActiveDirectory() {
    const events = [];
    
    try {
      const files = await fs.readdir(this.activeDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      console.log(`Found ${jsonFiles.length} active source files:`, jsonFiles);
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.activeDir, file);
          const data = await fs.readJson(filePath);
          const fileEvents = Array.isArray(data) ? data : [data];
          events.push(...fileEvents);
          console.log(`  ✓ ${file}: ${fileEvents.length} events`);
        } catch (error) {
          console.error(`  ✗ Error loading ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error reading active directory:', error.message);
    }
    
    return events;
  }

  async loadFromLegacyStructure() {
    const allEvents = [];
    const loadedSources = new Set();
    
    // First try latest directory  
    if (await fs.pathExists(this.latestDir)) {
      console.log('Loading from latest directory...');
      const latestEvents = await this.loadFromLatestDirectory();
      allEvents.push(...latestEvents.events);
      latestEvents.sources.forEach(source => loadedSources.add(source));
    }
    
    // Then load from flat structure for any missing sources
    console.log('Checking legacy directory for additional sources...');
    const legacyEvents = await this.loadFromLegacyDirectory(loadedSources);
    allEvents.push(...legacyEvents);
    
    return allEvents;
  }

  async loadFromLatestDirectory() {
    const events = [];
    const sources = new Set();
    
    try {
      const files = await fs.readdir(this.latestDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      console.log(`Found ${jsonFiles.length} files in latest directory`);
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.latestDir, file);
          const fileEvents = await fs.readJson(filePath);
          
          if (Array.isArray(fileEvents)) {
            console.log(`Loaded ${fileEvents.length} events from latest/${file}`);
            events.push(...fileEvents);
            
            // Track sources to avoid duplicate loading from legacy
            if (fileEvents.length > 0 && fileEvents[0].source) {
              sources.add(fileEvents[0].source);
            }
          } else {
            console.warn(`Invalid format in latest/${file}: expected array`);
          }
        } catch (error) {
          console.error(`Error loading latest/${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error reading latest directory:', error.message);
    }
    
    return { events, sources };
  }

  async loadFromLegacyDirectory(excludeSources = new Set()) {
    const events = [];
    
    try {
      // Check if scraped-events directory exists
      if (!(await fs.pathExists(this.dataDir))) {
        console.warn('Scraped events directory not found');
        return events;
      }
      
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter(file => 
        file.endsWith('.json') && 
        !file.includes('session-summary') // Skip session summaries
      );
      
      console.log(`Found ${jsonFiles.length} potential legacy files`);
      
      for (const file of jsonFiles) {
        try {
          // Skip files that are actually directories or system files
          const filePath = path.join(this.dataDir, file);
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) continue;
          
          const fileEvents = await fs.readJson(filePath);
          
          if (Array.isArray(fileEvents) && fileEvents.length > 0) {
            // Check if this source was already loaded from latest directory
            const source = fileEvents[0].source;
            if (source && excludeSources.has(source)) {
              console.log(`Skipping legacy ${file} - already loaded from latest`);
              continue;
            }
            
            console.log(`Loaded ${fileEvents.length} events from legacy/${file}`);
            events.push(...fileEvents);
          } else if (!Array.isArray(fileEvents)) {
            console.warn(`Invalid format in legacy/${file}: expected array`);
          }
        } catch (error) {
          console.error(`Error loading legacy/${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error reading legacy directory:', error.message);
    }
    
    return events;
  }

  // Get the most recent session directory
  async getMostRecentSession() {
    try {
      if (!(await fs.pathExists(this.sessionsDir))) {
        return null;
      }
      
      const sessions = await fs.readdir(this.sessionsDir);
      const validSessions = sessions.filter(session => {
        const sessionPath = path.join(this.sessionsDir, session);
        return fs.statSync(sessionPath).isDirectory() && 
               /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(session);
      }).sort().reverse(); // Most recent first
      
      return validSessions.length > 0 ? validSessions[0] : null;
    } catch (error) {
      console.error('Error getting most recent session:', error.message);
      return null;
    }
  }

  // Load events from a specific session
  async loadFromSession(sessionId) {
    const events = [];
    
    try {
      const sessionDir = path.join(this.sessionsDir, sessionId);
      
      if (!(await fs.pathExists(sessionDir))) {
        console.warn(`Session ${sessionId} not found`);
        return events;
      }
      
      const files = await fs.readdir(sessionDir);
      const jsonFiles = files.filter(file => 
        file.endsWith('.json') && 
        file !== 'session-summary.json'
      );
      
      console.log(`Loading ${jsonFiles.length} files from session ${sessionId}`);
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(sessionDir, file);
          const fileEvents = await fs.readJson(filePath);
          
          if (Array.isArray(fileEvents)) {
            console.log(`Loaded ${fileEvents.length} events from session/${sessionId}/${file}`);
            events.push(...fileEvents);
          } else {
            console.warn(`Invalid format in session/${sessionId}/${file}: expected array`);
          }
        } catch (error) {
          console.error(`Error loading session/${sessionId}/${file}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`Error loading from session ${sessionId}:`, error.message);
    }
    
    return events;
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
    
    // Compare dates (prefer startDate over date for better accuracy)
    const date1 = parseISO(event1.startDate || event1.date);
    const date2 = parseISO(event2.startDate || event2.date);
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
    const isDateSame = dateDifference === 0; // Must be EXACT same date for recurring events
    const isVenueSimilar = venueSimilarity >= this.duplicateThresholds.venueSimilarity || 
                          (!event1.venue || !event2.venue); // Similar venue or no venue info
    
    return isTitleSimilar && isDateSame && isVenueSimilar;
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
    if (event.date || event.startDate) score += 2;
    
    // Desirable fields
    if (event.description && event.description.length > 50) score += 1;
    if (event.image || event.imageUrl) score += 1;
    if (event.venue) score += 1;
    if (event.url) score += 1;
    if (event.tags && event.tags.length > 2) score += 1;
    if (event.price) score += 0.5;
    if (event.tickets) score += 0.5;
    
    // New schema fields (bonus points for more complete data)
    if (event.startDate && event.startDate !== event.date) score += 0.5; // More specific date
    if (event.endDate) score += 0.5;
    if (event.startTime) score += 0.5;
    if (event.endTime) score += 0.5;
    if (event.referenceUrl) score += 0.5;
    if (event.locationNote) score += 0.5;
    
    // Strongly prefer events that don't need review
    if (event.needsReview === false || event.needsReview === undefined) {
      score += 3; // Significant bonus for production-ready events
    } else if (event.needsReview === true) {
      score -= 1; // Penalty for events needing review
    }
    
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
        // Must have title and some form of date
        if (!event.title || (!event.date && !event.startDate)) return false;
        
        // Date must be valid and not in the past (prefer startDate over date)
        const eventDate = parseISO(event.startDate || event.date);
        if (!isValid(eventDate)) {
          console.warn(`Invalid date for event: ${event.title}`);
          return false;
        }
        
        // Allow events from today onwards (not strictly future)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        if (eventDate < today) {
          console.warn(`Past event filtered: ${event.title} - ${event.startDate || event.date}`);
          return false;
        }
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

  separateEventsForReview(events) {
    const productionEvents = [];
    const reviewEvents = [];
    
    events.forEach(event => {
      if (event.needsReview === true) {
        reviewEvents.push(event);
      } else {
        productionEvents.push(event);
      }
    });
    
    return { productionEvents, reviewEvents };
  }

  async saveReviewEvents(reviewEvents) {
    if (reviewEvents.length === 0) {
      console.log('No events need review');
      return;
    }
    
    const reviewFilepath = path.join(this.reviewOutputDir, 'events-to-review.json');
    await fs.writeJson(reviewFilepath, reviewEvents, { spaces: 2 });
    console.log(`Saved ${reviewEvents.length} events needing review to ${reviewFilepath}`);
    
    return reviewFilepath;
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
    // Standardize venue format and enrich venue data
    if (event.venue && typeof event.venue === 'string') {
      event.venue = { name: event.venue };
    }
    
    // Enrich venue data with known information
    if (event.venue && event.venue.name) {
      const enrichedVenue = this.enrichVenueData(event.venue);
      event.venue = enrichedVenue;
    }
    
    // Ensure tags are clean
    if (event.tags) {
      event.tags = event.tags
        .filter(tag => tag && typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }
    
    // Clean up and normalize URLs
    if (event.url && !event.url.startsWith('http')) {
      delete event.url;
    }
    
    if (event.tickets && !event.tickets.startsWith('http')) {
      delete event.tickets;
    }
    
    if (event.image && !event.image.startsWith('http')) {
      delete event.image;
    }
    
    // Only preserve legitimate image URLs - don't convert relative paths without verification
    if (event.imageUrl && !event.imageUrl.startsWith('http')) {
      // For now, remove relative paths since we can't verify they exist
      // In the future, actual scrapers should provide full URLs or verified paths
      delete event.imageUrl;
    }
    
    if (event.referenceUrl && !event.referenceUrl.startsWith('http')) {
      delete event.referenceUrl;
    }
    
    // Do NOT generate URLs - only preserve legitimate ones that exist
    // URLs should only come from actual scraped data, not be generated
    
    // Clean location note if present
    if (event.locationNote && typeof event.locationNote === 'string') {
      event.locationNote = event.locationNote.trim();
      if (event.locationNote.length === 0) {
        delete event.locationNote;
      }
    }
    
    // Preserve new date/time fields - ensure they're valid dates if present
    ['startDate', 'endDate'].forEach(field => {
      if (event[field] && !isValid(parseISO(event[field]))) {
        delete event[field];
      }
    });
    
    // Preserve time fields as strings (they might be in various formats)
    ['startTime', 'endTime'].forEach(field => {
      if (event[field] && typeof event[field] === 'string') {
        event[field] = event[field].trim();
        if (event[field].length === 0) {
          delete event[field];
        }
      }
    });
    
    // Ensure needsReview is a proper boolean
    if (event.needsReview !== undefined) {
      event.needsReview = Boolean(event.needsReview);
    }
    
    return event;
  }

  enrichVenueData(venue) {
    // Known venue information database
    const knownVenues = {
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
      'bonner county fairgrounds': {
        name: 'Bonner County Fairgrounds',
        address: '4203 N. Boyer Ave, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 263-8691',
        website: 'https://www.bonnercountyfair.com'
      },
      'matchwood': {
        name: 'Matchwood',
        address: '513 Oak St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 255-4012',
        website: 'https://www.matchwoodsandpoint.com'
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
      'connie\'s': {
        name: 'Connie\'s',
        address: '323 Cedar St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 263-9391',
        website: ''
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
      'the tervan': {
        name: 'The Tervan',
        address: '411 Cedar St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 610-4988',
        website: 'https://www.thetervan.com'
      },
      'roxy\'s': {
        name: 'Roxy\'s',
        address: '215 Pine St, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '(208) 265-2012',
        website: ''
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
      'farmin park': {
        name: 'Farmin Park',
        address: 'Farmin Park, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '',
        website: ''
      },
      'lakeview park': {
        name: 'Lakeview Park',
        address: 'Lakeview Park, Sandpoint, ID 83864',
        city: 'Sandpoint',
        state: 'ID',
        zipCode: '83864',
        phone: '',
        website: ''
      }
    };

    const venueName = venue.name.toLowerCase().trim();
    const knownVenue = knownVenues[venueName];

    if (knownVenue) {
      return { ...knownVenue };
    } else {
      // Return venue with standard empty fields if not known
      return {
        name: venue.name,
        address: venue.address || '',
        city: venue.city || 'Sandpoint',
        state: venue.state || 'ID',
        zipCode: venue.zipCode || '',
        phone: venue.phone || '',
        website: venue.website || ''
      };
    }
  }

  sortEventsByDate(events) {
    return events.sort((a, b) => {
      // Prefer startDate over date for more accurate sorting
      const dateA = parseISO(a.startDate || a.date);
      const dateB = parseISO(b.startDate || b.date);
      return dateA - dateB;
    });
  }

  async saveEvents(events, filename) {
    // Validate time data before saving
    console.log('\n🕐 Validating event time data before saving...');
    const validationReport = validateEventBatch(events);
    logValidationReport(validationReport);

    if (validationReport.summary.eventsWithWarnings > 0) {
      console.log('⚠️  Some events have time warnings. Review the data if needed.');
    }

    // Use validated events (with any fixes applied by the validator)
    const finalEvents = validationReport.summary.validatedEvents;

    const filepath = path.join(this.outputDir, filename);
    await fs.writeJson(filepath, finalEvents, { spaces: 2 });
    console.log(`Saved ${finalEvents.length} merged events to ${filepath}`);

    // Also save as events.json for easy access
    const mainFilepath = path.join(this.outputDir, 'events.json');
    await fs.writeJson(mainFilepath, finalEvents, { spaces: 2 });
    console.log(`Also saved as ${mainFilepath}`);

    return filepath;
  }

  async generateMergeReport(originalEvents, productionEvents, reviewEvents = []) {
    const totalMerged = productionEvents.length + reviewEvents.length;
    const report = {
      timestamp: new Date().toISOString(),
      original_count: originalEvents.length,
      production_count: productionEvents.length,
      review_count: reviewEvents.length,
      total_merged_count: totalMerged,
      duplicates_removed: originalEvents.length - totalMerged,
      sources: {},
      date_range: {
        earliest: null,
        latest: null
      },
      venues: {},
      tags: {},
      field_completeness: {
        startDate: 0,
        endDate: 0,
        startTime: 0,
        endTime: 0,
        referenceUrl: 0,
        locationNote: 0
      }
    };

    // Analyze sources
    originalEvents.forEach(event => {
      const source = event.source || 'Unknown';
      report.sources[source] = (report.sources[source] || 0) + 1;
    });

    // Analyze both production and review events for comprehensive statistics
    const allMergedEvents = [...productionEvents, ...reviewEvents];
    allMergedEvents.forEach(event => {
      // Date range (prefer startDate over date)
      const eventDate = parseISO(event.startDate || event.date);
      if (!report.date_range.earliest || eventDate < parseISO(report.date_range.earliest)) {
        report.date_range.earliest = event.startDate || event.date;
      }
      if (!report.date_range.latest || eventDate > parseISO(report.date_range.latest)) {
        report.date_range.latest = event.startDate || event.date;
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
      
      // Track new field completeness
      if (event.startDate) report.field_completeness.startDate++;
      if (event.endDate) report.field_completeness.endDate++;
      if (event.startTime) report.field_completeness.startTime++;
      if (event.endTime) report.field_completeness.endTime++;
      if (event.referenceUrl) report.field_completeness.referenceUrl++;
      if (event.locationNote) report.field_completeness.locationNote++;
    });

    const reportPath = path.join(this.outputDir, 'merge-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`Merge report saved to ${reportPath}`);

    // Print summary
    console.log('\n--- MERGE SUMMARY ---');
    console.log(`Original events: ${report.original_count}`);
    console.log(`Production ready events: ${report.production_count}`);
    console.log(`Events needing review: ${report.review_count}`);
    console.log(`Total merged events: ${report.total_merged_count}`);
    console.log(`Duplicates removed: ${report.duplicates_removed}`);
    console.log(`Date range: ${report.date_range.earliest} to ${report.date_range.latest}`);
    console.log(`Sources:`, Object.keys(report.sources).map(s => `${s}: ${report.sources[s]}`).join(', '));
    console.log(`Field completeness:`);
    Object.entries(report.field_completeness).forEach(([field, count]) => {
      const percentage = Math.round((count / report.total_merged_count) * 100);
      console.log(`  ${field}: ${count}/${report.total_merged_count} (${percentage}%)`);
    });
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

// CLI execution
if (require.main === module) {
  const merger = new EventMerger();
  
  console.log('🔄 Starting event merger...');
  console.log('📂 Scanning session directories for events to merge...');
  
  merger.mergeAllEvents()
    .then(report => {
      console.log(`\n✅ Event merging completed successfully!`);
      console.log(`📊 Merged ${report.total_merged_count} events from ${report.original_count} total`);
      console.log(`🎯 Production ready: ${report.production_count}`);
      console.log(`⚠️  Needs review: ${report.review_count}`);
      console.log(`🗑️  Duplicates removed: ${report.duplicates_removed}`);
      console.log(`📁 Files saved to: ${merger.outputDir}`);
    })
    .catch(error => {
      console.error('❌ Event merging failed:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    });
}