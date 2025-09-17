const EventScraper = require('../utils/eventScraper');
const IntelligentTextParser = require('../utils/intelligentTextParser');
const fs = require('fs-extra');
const path = require('path');

class SandpointOnlineScraper extends EventScraper {
  constructor(options = {}) {
    super();
    this.baseUrl = 'https://sandpointonline.com';
    this.eventsUrl = 'https://sandpointonline.com/current/index.shtml';
    this.source = 'Sandpoint Online';
    this.stateFile = path.join(process.cwd(), 'data', 'scraper-state', 'sandpoint-online-state.json');
    this.textParser = new IntelligentTextParser({ source: this.source });
    
    // CLI options
    this.options = {
      reset: options.reset || false,
      maxEvents: options.maxEvents || 10,
      startIndex: options.startIndex || null,
      ...options
    };
    
    // State management
    this.state = this.loadState();
  }

  /**
   * Load scraper state from persistent storage
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch (error) {
      console.warn('Failed to load scraper state, using defaults:', error.message);
    }
    
    // Return default state
    return {
      lastScrapedDate: null,
      lastProcessedIndex: 0,
      currentPage: 1,
      eventsPerPage: 10,
      totalEventsFound: 0,
      isComplete: false,
      metadata: {
        scraperVersion: '2.0.0',
        lastUpdated: null,
        settings: {
          baseUrl: this.baseUrl,
          eventsUrl: this.eventsUrl,
          source: this.source
        }
      },
      statistics: {
        totalEventsScraped: 0,
        eventsNeedingReview: 0,
        eventsReadyForProduction: 0,
        lastRunDuration: 0,
        averageEventsPerRun: 0
      }
    };
  }

  /**
   * Save scraper state to persistent storage
   */
  saveState() {
    try {
      fs.ensureDirSync(path.dirname(this.stateFile));
      this.state.metadata.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Failed to save scraper state:', error.message);
    }
  }

  /**
   * Reset scraper state to initial values
   */
  resetState() {
    this.state.lastScrapedDate = null;
    this.state.lastProcessedIndex = 0;
    this.state.currentPage = 1;
    this.state.totalEventsFound = 0;
    this.state.isComplete = false;
    this.state.statistics = {
      totalEventsScraped: 0,
      eventsNeedingReview: 0,
      eventsReadyForProduction: 0,
      lastRunDuration: 0,
      averageEventsPerRun: 0
    };
    this.saveState();
    console.log('🔄 Scraper state has been reset');
  }

  /**
   * Enhanced scrapeEvents method with pagination and state management
   */
  async scrapeEvents() {
    const startTime = Date.now();
    
    // Handle CLI options
    if (this.options.reset) {
      this.resetState();
    }
    
    if (this.options.startIndex !== null) {
      this.state.lastProcessedIndex = this.options.startIndex;
      this.state.currentPage = Math.floor(this.options.startIndex / this.state.eventsPerPage) + 1;
    }
    
    if (this.options.maxEvents) {
      this.state.eventsPerPage = this.options.maxEvents;
    }

    const resumeIndex = this.state.lastProcessedIndex;
    const currentPage = this.state.currentPage;
    const maxEvents = this.state.eventsPerPage;
    
    console.log('🚀 Starting SandpointOnline scraper...');
    if (resumeIndex > 0) {
      console.log(`📍 Resuming from index ${resumeIndex} (Page ${currentPage})`);
    } else {
      console.log('🆕 Starting from beginning');
    }
    
    try {
      const { $ } = await this.scrapeWithCheerio(this.eventsUrl);
      
      // Extract ALL potential events first
      const allEventElements = this.getAllEventElements($);
      this.state.totalEventsFound = allEventElements.length;
      
      console.log(`🔍 Found ${allEventElements.length} potential events on page`);
      
      // Apply pagination - slice the events based on current position
      const endIndex = resumeIndex + maxEvents;
      const eventsToProcess = allEventElements.slice(resumeIndex, endIndex);
      
      console.log(`📋 Processing events ${resumeIndex + 1}-${Math.min(endIndex, allEventElements.length)} (${eventsToProcess.length} events this run)`);
      
      // Process events with intelligent text parser
      const events = await this.processEventsWithIntelligentParser($, eventsToProcess, resumeIndex);
      
      // Update state
      const newIndex = resumeIndex + eventsToProcess.length;
      this.state.lastProcessedIndex = newIndex;
      this.state.currentPage = Math.floor(newIndex / this.state.eventsPerPage) + 1;
      this.state.isComplete = newIndex >= allEventElements.length;
      this.state.lastScrapedDate = new Date().toISOString();
      
      // Update statistics
      const reviewCount = events.filter(event => event.needsReview).length;
      const readyCount = events.length - reviewCount;
      
      this.state.statistics.totalEventsScraped += events.length;
      this.state.statistics.eventsNeedingReview += reviewCount;
      this.state.statistics.eventsReadyForProduction += readyCount;
      this.state.statistics.lastRunDuration = Date.now() - startTime;
      this.state.statistics.averageEventsPerRun = 
        Math.round(this.state.statistics.totalEventsScraped / (this.state.currentPage || 1));
      
      // Save state
      this.saveState();
      
      // Progress reporting
      this.reportProgress(events.length, reviewCount, newIndex);
      
      // Save events to file with timestamp
      const filename = `sandpoint-online-${new Date().toISOString().split('T')[0]}-page-${this.state.currentPage - 1}.json`;
      await this.saveEvents(events, filename);
      
      // Finalize session
      await this.finalizeSession({
        eventsFound: events.length,
        currentPage: this.state.currentPage - 1,
        totalPagesProcessed: this.state.currentPage - 1,
        source: this.source
      });
      
      return events;
    } catch (error) {
      console.error(`❌ Error scraping ${this.source}:`, error.message);
      return [];
    }
  }

  /**
   * Get all potential event elements from the page
   */
  getAllEventElements($) {
    const eventElements = [];
    
    // Look through all paragraph tags and text content
    $('p').each((index, element) => {
      const $p = $(element);
      const text = $p.text().trim();
      
      if (text.length >= 10) { // Filter out very short paragraphs
        eventElements.push({
          element: $p,
          text: text,
          index: index
        });
      }
    });
    
    // Also check for bold text patterns that might contain dates
    $('b, strong').each((index, element) => {
      const $bold = $(element);
      const boldText = $bold.text().trim();
      
      // Look for date patterns in bold text
      if (this.isDateText(boldText)) {
        const $parent = $bold.parent();
        const fullText = $parent.text().trim();
        
        if (fullText.length > boldText.length + 10) {
          // Check if we already have this text
          const exists = eventElements.some(el => el.text === fullText);
          if (!exists) {
            eventElements.push({
              element: $parent,
              text: fullText,
              index: `bold-${index}`
            });
          }
        }
      }
    });
    
    return eventElements;
  }

  /**
   * Process events using the intelligent text parser
   */
  async processEventsWithIntelligentParser($, eventElements, startIndex) {
    const events = [];
    
    for (let i = 0; i < eventElements.length; i++) {
      const { element, text } = eventElements[i];
      const globalIndex = startIndex + i;
      
      try {
        // Use intelligent text parser instead of manual parsing
        const eventData = this.textParser.parseEventText(text, {
          source: this.source,
          referenceUrl: this.eventsUrl,
          globalIndex: globalIndex
        });
        
        if (eventData && eventData.title && eventData.title !== 'Untitled Event') {
          // Set reference URL
          eventData.referenceUrl = this.eventsUrl;
          
          // Normalize the event using parent class
          const normalizedEvent = this.normalizeEvent(eventData, this.source);
          events.push(normalizedEvent);
          
          console.log(`✅ Processed event ${globalIndex + 1}: "${eventData.title}"`);
        } else {
          console.log(`⏭️  Skipped event ${globalIndex + 1}: Unable to extract meaningful data`);
        }
      } catch (error) {
        console.warn(`⚠️  Error processing event ${globalIndex + 1}: ${error.message}`);
      }
    }
    
    return events;
  }

  /**
   * Enhanced progress reporting
   */
  reportProgress(eventsScraped, reviewCount, newIndex) {
    const totalEvents = this.state.totalEventsFound;
    const progressPercent = totalEvents > 0 ? Math.round((newIndex / totalEvents) * 100) : 0;
    const readyCount = eventsScraped - reviewCount;
    
    console.log(`\n📊 Progress Report:`);
    console.log(`✅ Scraped events ${this.state.lastProcessedIndex - eventsScraped + 1}-${newIndex} (${eventsScraped} new events)`);
    console.log(`📊 Total progress: ${newIndex}/${totalEvents} events (${progressPercent}% complete)`);
    console.log(`🎯 Events ready for production: ${readyCount}`);
    if (reviewCount > 0) {
      console.log(`⚠️  Events needing review: ${reviewCount}`);
    }
    
    if (this.state.isComplete) {
      console.log(`🎉 All events have been processed!`);
      console.log(`💾 State saved - scraping is complete`);
    } else {
      console.log(`💾 State saved - next run will start from index ${newIndex}`);
      console.log(`🔄 Run 'npm run scrape:sandpoint' to continue from where you left off`);
    }
    
    // Summary statistics
    console.log(`\n📈 Session Statistics:`);
    console.log(`⏱️  Run duration: ${Math.round(this.state.statistics.lastRunDuration / 1000)}s`);
    console.log(`📊 Total events scraped: ${this.state.statistics.totalEventsScraped}`);
    console.log(`📅 Average events per run: ${this.state.statistics.averageEventsPerRun}`);
  }

  /**
   * Legacy method - replaced by intelligent text parser integration
   * Kept for backward compatibility but now uses the intelligent parser
   */
  extractFromParagraphs($) {
    console.log('⚠️  Using legacy extractFromParagraphs - consider using the full scrapeEvents() method for better pagination support');
    
    const eventElements = this.getAllEventElements($);
    return this.processEventsWithIntelligentParser($, eventElements.slice(0, 20), 0); // Limit for legacy compatibility
  }

  parseEventFromText(text, $element) {
    const eventData = {
      needsReview: false
    };
    
    // Extract date from bold/strong tags or date patterns
    const dateMatch = this.extractDateFromText(text);
    if (dateMatch) {
      eventData.startDate = dateMatch.date;
      eventData.date = dateMatch.date; // For backward compatibility
    } else {
      eventData.needsReview = true;
    }
    
    // Extract time ranges (e.g., "2–4 p.m.", "7:00 PM - 9:00 PM")
    const timeMatch = this.extractTimeFromText(text);
    if (timeMatch) {
      eventData.startTime = timeMatch.startTime;
      eventData.endTime = timeMatch.endTime;
    } else {
      eventData.needsReview = true;
    }
    
    // Extract title and description
    const titleAndDesc = this.extractTitleAndDescription(text);
    if (titleAndDesc.title) {
      eventData.title = titleAndDesc.title;
      eventData.description = titleAndDesc.description;
    } else {
      return null; // No title means not a valid event
    }
    
    // Extract venue/location information
    const location = this.extractLocationFromText(text);
    if (location.venue) {
      eventData.venue = location.venue;
    } else if (location.locationNote) {
      eventData.venue = null;
      eventData.locationNote = location.locationNote;
    } else {
      eventData.needsReview = true;
    }
    
    // Check if performer info is missing (for events that should have it)
    if (this.shouldHavePerformer(text) && !this.hasPerformerInfo(text)) {
      eventData.needsReview = true;
    }
    
    return eventData;
  }

  isDateText(text) {
    const datePatterns = [
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      /\b\d{4}-\d{2}-\d{2}\b/,
      /\b\w+,?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/i
    ];
    
    return datePatterns.some(pattern => pattern.test(text));
  }

  extractTimeFromText(text) {
    // Match various time patterns: "2–4 p.m.", "7:00 PM - 9:00 PM", "from 2-4pm"
    const timePatterns = [
      /\b(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)\s*[-–—to]\s*(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)\b/i,
      /\b(\d{1,2})\s*[-–—to]\s*(\d{1,2})\s*([ap]\.?m\.?)\b/i,
      /\bfrom\s+(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)\s*[-–—to]\s*(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)\b/i
    ];
    
    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        const startHour = parseInt(match[1]);
        const startMin = match[2] ? parseInt(match[2]) : 0;
        const startPeriod = match[3] || match[6];
        
        let endHour, endMin, endPeriod;
        if (match[4]) {
          endHour = parseInt(match[4]);
          endMin = match[5] ? parseInt(match[5]) : 0;
          endPeriod = match[6] || startPeriod;
        } else {
          endHour = parseInt(match[2] || match[4]);
          endMin = 0;
          endPeriod = match[3];
        }
        
        return {
          startTime: this.formatTime(startHour, startMin, startPeriod),
          endTime: this.formatTime(endHour, endMin, endPeriod)
        };
      }
    }
    
    return null;
  }

  formatTime(hour, minute, period) {
    if (period && period.toLowerCase().includes('p') && hour < 12) {
      hour += 12;
    } else if (period && period.toLowerCase().includes('a') && hour === 12) {
      hour = 0;
    }
    
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  extractTitleAndDescription(text) {
    // Remove date and time information to get cleaner title
    let cleanText = text
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*/i, '')
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s*(\d{4})?\b/i, '')
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/, '')
      .replace(/\b\d{1,2}:?\d{0,2}\s*[ap]\.?m\.?\s*[-–—to]\s*\d{1,2}:?\d{0,2}\s*[ap]\.?m\.?\b/i, '')
      .replace(/\bfrom\s+\d{1,2}:?\d{0,2}\s*[ap]\.?m\.?\s*[-–—to]\s*\d{1,2}:?\d{0,2}\s*[ap]\.?m\.?\b/i, '')
      .trim();
    
    // Split into sentences
    const sentences = cleanText.split(/[.!?]+/).map(s => s.trim()).filter(s => s);
    
    if (sentences.length === 0) return { title: null, description: null };
    
    // First sentence or phrase before colon is usually the title
    let title = sentences[0];
    if (title.includes(':')) {
      title = title.split(':')[0].trim();
    }
    
    // Everything else becomes description
    const description = sentences.slice(1).join('. ').trim();
    
    return {
      title: title.length > 0 ? title : null,
      description: description.length > 0 ? description : null
    };
  }

  extractLocationFromText(text) {
    const locationPatterns = [
      /\bat\s+([^,.\n]+)/i,
      /\bvenue:?\s+([^,.\n]+)/i,
      /\blocation:?\s+([^,.\n]+)/i,
      /\b@\s+([^,.\n]+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        
        // Check if it's a specific venue or vague location
        const vaguePatterns = [
          /\b(downtown|city|area|various|multiple|tbd|tba)\b/i
        ];
        
        if (vaguePatterns.some(pattern => pattern.test(location))) {
          return { venue: null, locationNote: location };
        } else {
          return { venue: location, locationNote: null };
        }
      }
    }
    
    return { venue: null, locationNote: null };
  }

  shouldHavePerformer(text) {
    return /\b(concert|music|band|singer|performance|show|artist)\b/i.test(text);
  }

  hasPerformerInfo(text) {
    return /\bfeaturing|with|by|starring|performing\b/i.test(text);
  }

  extractEventData($, $element) {
    // Try multiple extraction patterns
    const patterns = {
      title: [
        '.event-title',
        '.title',
        'h3',
        'h2',
        'h1',
        '[class*="title"]',
        '.summary'
      ],
      date: [
        '.event-date',
        '.date',
        '.dtstart',
        '[datetime]',
        '[class*="date"]',
        'time'
      ],
      description: [
        '.event-description',
        '.description',
        '.event-summary',
        'p',
        '.content'
      ],
      url: [
        'a[href]'
      ],
      venue: [
        '.venue',
        '.location',
        '.event-venue',
        '[class*="venue"]',
        '[class*="location"]'
      ],
      image: [
        'img'
      ]
    };

    const eventData = {};

    // Extract title
    for (const selector of patterns.title) {
      const titleEl = $element.find(selector).first();
      if (titleEl.length && titleEl.text().trim()) {
        eventData.title = titleEl.text().trim();
        break;
      }
    }

    // Extract date
    for (const selector of patterns.date) {
      const dateEl = $element.find(selector).first();
      if (dateEl.length) {
        eventData.date = dateEl.attr('datetime') || 
                         dateEl.attr('content') ||
                         dateEl.text().trim();
        if (eventData.date) break;
      }
    }

    // Extract description
    for (const selector of patterns.description) {
      const descEl = $element.find(selector).first();
      if (descEl.length && descEl.text().trim() && descEl.text().trim() !== eventData.title) {
        eventData.description = descEl.text().trim();
        break;
      }
    }

    // Extract URL - look for multiple types of links
    const linkSelectors = [
      'a[href*="event"]',
      'a[href*="ticket"]',
      'a[href*="register"]',
      'a[href*="info"]',
      'a[href]'
    ];
    
    for (const selector of linkSelectors) {
      const linkEl = $element.find(selector).first();
      if (linkEl.length) {
        let url = linkEl.attr('href');
        if (url && !url.startsWith('http') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
          url = new URL(url, this.baseUrl).toString();
        }
        if (url && url.startsWith('http')) {
          eventData.url = url;
          
          // Check if this looks like a ticket URL specifically
          if (url.includes('ticket') || url.includes('buy') || url.includes('purchase') || 
              linkEl.text().toLowerCase().includes('ticket') || 
              linkEl.text().toLowerCase().includes('buy')) {
            eventData.ticketUrl = url;
          }
          break;
        }
      }
    }
    
    // Look specifically for ticket/registration links
    const ticketSelectors = [
      'a[href*="ticket"]',
      'a[href*="buy"]',
      'a[href*="register"]',
      'a[href*="eventbrite"]',
      'a:contains("Tickets")',
      'a:contains("Buy")',
      'a:contains("Register")',
      '.ticket-link a',
      '.buy-tickets a'
    ];
    
    if (!eventData.ticketUrl) {
      for (const selector of ticketSelectors) {
        const ticketEl = $element.find(selector).first();
        if (ticketEl.length) {
          let ticketUrl = ticketEl.attr('href');
          if (ticketUrl && !ticketUrl.startsWith('http') && !ticketUrl.startsWith('mailto:')) {
            ticketUrl = new URL(ticketUrl, this.baseUrl).toString();
          }
          if (ticketUrl && ticketUrl.startsWith('http')) {
            eventData.ticketUrl = ticketUrl;
            break;
          }
        }
      }
    }

    // Extract venue
    for (const selector of patterns.venue) {
      const venueEl = $element.find(selector).first();
      if (venueEl.length && venueEl.text().trim()) {
        eventData.venue = venueEl.text().trim();
        break;
      }
    }

    // Extract image - look for high-quality event images
    const imageSelectors = [
      '.event-image img',
      '.event-photo img',
      '.featured-image img',
      'img[alt*="event"]',
      'img[src*="event"]',
      '.thumbnail img',
      'img'
    ];
    
    for (const selector of imageSelectors) {
      const imgEl = $element.find(selector).first();
      if (imgEl.length) {
        let imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src');
        
        if (imgSrc) {
          // Skip very small images, logos, or generic placeholders
          const width = imgEl.attr('width') || imgEl.css('width');
          const height = imgEl.attr('height') || imgEl.css('height');
          
          // Skip if dimensions are too small (likely icons or logos)
          if ((width && parseInt(width) < 100) || (height && parseInt(height) < 100)) {
            continue;
          }
          
          // Skip common logo/icon filenames
          const filename = imgSrc.toLowerCase();
          if (filename.includes('logo') || filename.includes('icon') || 
              filename.includes('avatar') || filename.includes('profile')) {
            continue;
          }
          
          // Convert relative URLs to absolute
          if (!imgSrc.startsWith('http')) {
            if (imgSrc.startsWith('//')) {
              imgSrc = 'https:' + imgSrc;
            } else {
              imgSrc = new URL(imgSrc, this.baseUrl).toString();
            }
          }
          
          eventData.image = imgSrc;
          break;
        }
      }
    }
    
    // If we still don't have an image, check for background images
    if (!eventData.image) {
      const bgElements = $element.find('[style*="background-image"]');
      bgElements.each((i, el) => {
        const style = $(el).attr('style') || '';
        const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
        if (bgMatch && bgMatch[1]) {
          let bgImg = bgMatch[1];
          if (!bgImg.startsWith('http')) {
            bgImg = new URL(bgImg, this.baseUrl).toString();
          }
          eventData.image = bgImg;
          return false; // Break out of each loop
        }
      });
    }

    return eventData;
  }

  extractFromJsonLd(jsonLdData) {
    const events = [];

    for (const data of jsonLdData) {
      if (data['@type'] === 'Event' || (Array.isArray(data) && data.some(item => item['@type'] === 'Event'))) {
        const eventArray = Array.isArray(data) ? data.filter(item => item['@type'] === 'Event') : [data];
        
        for (const eventItem of eventArray) {
          try {
            const eventData = {
              title: eventItem.name,
              description: eventItem.description,
              date: eventItem.startDate,
              endDate: eventItem.endDate,
              url: eventItem.url,
              ticketUrl: eventItem.offers?.url || 
                        (eventItem.offers && Array.isArray(eventItem.offers) ? eventItem.offers[0]?.url : null) ||
                        eventItem.ticketUrl,
              venue: eventItem.location?.name || eventItem.location,
              image: eventItem.image?.url || eventItem.image,
              price: eventItem.offers?.price || eventItem.offers?.lowPrice ||
                    (eventItem.offers && Array.isArray(eventItem.offers) ? eventItem.offers[0]?.price : null)
            };

            if (eventData.title && eventData.date) {
              const normalizedEvent = this.normalizeEvent(eventData, this.source);
              events.push(normalizedEvent);
            }
          } catch (error) {
            console.warn(`Skipping invalid JSON-LD event: ${error.message}`);
          }
        }
      }
    }

    return events;
  }

  extractGenericEvents($) {
    const events = [];
    const potentialEvents = [];

    // Look for common event patterns in the HTML
    $('*').each((index, element) => {
      const $el = $(element);
      const text = $el.text().toLowerCase();

      // Skip if too little or too much text
      if (text.length < 10 || text.length > 500) return;

      // Look for date patterns and event keywords
      const hasDatePattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/i.test(text);
      const hasEventKeywords = /\b(event|concert|show|festival|meeting|workshop|class|seminar|performance|party|celebration)\b/i.test(text);

      if (hasDatePattern && hasEventKeywords) {
        potentialEvents.push($el);
      }
    });

    // Process potential events
    potentialEvents.slice(0, 20).forEach(($el, index) => {
      try {
        const text = $el.text().trim();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length >= 2) {
          const eventData = {
            title: lines[0],
            description: lines.slice(1).join(' ').substring(0, 200),
            date: this.extractDateFromText(text),
            venue: this.extractVenueFromText(text)
          };

          if (eventData.title && eventData.date) {
            const normalizedEvent = this.normalizeEvent(eventData, this.source);
            events.push(normalizedEvent);
          }
        }
      } catch (error) {
        console.warn(`Skipping potential event: ${error.message}`);
      }
    });

    return events.slice(0, 10); // Limit to prevent noise
  }

  extractDateFromText(text) {
    const datePatterns = [
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      /\b\d{4}-\d{2}-\d{2}\b/,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          // Try to parse the date and return it in ISO format
          const dateStr = match[0];
          const parsedDate = new Date(dateStr);
          
          // If parsing fails, try manual parsing for formats like "Saturday, August 10"
          if (isNaN(parsedDate.getTime())) {
            return this.parsePartialDate(dateStr);
          }
          
          return { date: parsedDate.toISOString().split('T')[0] };
        } catch (error) {
          console.warn(`Failed to parse date: ${match[0]}`);
          return { date: match[0] };
        }
      }
    }

    return null;
  }

  parsePartialDate(dateStr) {
    const currentYear = new Date().getFullYear();
    
    // Handle formats like "Saturday, August 10"
    const partialMatch = dateStr.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\b/i);
    
    if (partialMatch) {
      const month = partialMatch[1];
      const day = partialMatch[2];
      
      try {
        const fullDateStr = `${month} ${day}, ${currentYear}`;
        const parsedDate = new Date(fullDateStr);
        
        // If the date has already passed this year, assume next year
        if (parsedDate < new Date()) {
          parsedDate.setFullYear(currentYear + 1);
        }
        
        return { date: parsedDate.toISOString().split('T')[0] };
      } catch (error) {
        return { date: dateStr };
      }
    }
    
    return { date: dateStr };
  }

  extractVenueFromText(text) {
    const venuePatterns = [
      /\bat\s+([^,\n]+)/i,
      /\bvenue:?\s+([^,\n]+)/i,
      /\blocation:?\s+([^,\n]+)/i
    ];

    for (const pattern of venuePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }
}

module.exports = SandpointOnlineScraper;

/**
 * Parse command line arguments for CLI options
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    reset: false,
    maxEvents: null,
    startIndex: null
  };
  
  for (const arg of args) {
    if (arg === '--reset') {
      options.reset = true;
    } else if (arg.startsWith('--max-events=')) {
      const value = parseInt(arg.split('=')[1]);
      if (!isNaN(value) && value > 0) {
        options.maxEvents = value;
      } else {
        console.error('❌ Invalid --max-events value. Must be a positive number.');
        process.exit(1);
      }
    } else if (arg.startsWith('--start-index=')) {
      const value = parseInt(arg.split('=')[1]);
      if (!isNaN(value) && value >= 0) {
        options.startIndex = value;
      } else {
        console.error('❌ Invalid --start-index value. Must be a non-negative number.');
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
SandpointOnline Scraper v2.0.0
`);
      console.log('Usage: npm run scrape:sandpoint [options]\n');
      console.log('Options:');
      console.log('  --reset                    Reset state and start from beginning');
      console.log('  --max-events=N             Set maximum events per run (default: 10)');
      console.log('  --start-index=N            Start from specific index (overrides saved state)');
      console.log('  --help, -h                 Show this help message\n');
      console.log('Examples:');
      console.log('  npm run scrape:sandpoint                    # Resume from last position');
      console.log('  npm run scrape:sandpoint -- --reset        # Start from beginning');
      console.log('  npm run scrape:sandpoint -- --max-events=5 # Custom batch size');
      console.log('  npm run scrape:sandpoint -- --start-index=15 # Start from specific position\n');
      process.exit(0);
    } else {
      console.error(`❌ Unknown argument: ${arg}`);
      console.log('Use --help for usage information.');
      process.exit(1);
    }
  }
  
  return options;
}

// Execute the scraper if this file is run directly
if (require.main === module) {
  async function run() {
    const options = parseCliArgs();
    const scraper = new SandpointOnlineScraper(options);
    
    try {
      const events = await scraper.scrapeEvents();
      
      console.log(`\n✅ Scraping session completed! Processed ${events.length} events this run`);
      
      if (events.length > 0) {
        const reviewCount = events.filter(event => event.needsReview).length;
        const readyCount = events.length - reviewCount;
        
        console.log(`\n📊 Final Results:`);
        console.log(`✅ Events ready for production: ${readyCount}`);
        if (reviewCount > 0) {
          console.log(`⚠️  Events needing review: ${reviewCount}`);
        }
        
        // Show sample event
        console.log('\n📋 Sample event structure:');
        const sampleEvent = { ...events[0] };
        // Truncate long description for readability
        if (sampleEvent.description && sampleEvent.description.length > 100) {
          sampleEvent.description = sampleEvent.description.substring(0, 100) + '...';
        }
        console.log(JSON.stringify(sampleEvent, null, 2));
        
        // Show next steps
        console.log(`\n🚀 Next Steps:`);
        const state = scraper.state;
        if (state.isComplete) {
          console.log(`✅ All events have been processed! You can now:`);
          console.log(`   • Review events needing attention in the output files`);
          console.log(`   • Run the event merger: npm run events:merge`);
          console.log(`   • Reset and scrape again: npm run scrape:sandpoint -- --reset`);
        } else {
          const remaining = state.totalEventsFound - state.lastProcessedIndex;
          console.log(`⏳ ${remaining} events remaining to process`);
          console.log(`🔄 Continue scraping: npm run scrape:sandpoint`);
          console.log(`🎯 Skip to specific position: npm run scrape:sandpoint -- --start-index=N`);
        }
      } else {
        console.log('⚠️  No events were processed this run.');
        console.log('This might indicate:');
        console.log('  • All events have already been processed');
        console.log('  • The website structure has changed');
        console.log('  • Network or parsing issues occurred');
      }
      
    } catch (error) {
      console.error('\n❌ Scraper failed:', error.message);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }
  
  run();
}