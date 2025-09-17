const EventScraper = require('../utils/eventScraper');
const axios = require('axios');

class EventbriteScraper extends EventScraper {
  constructor() {
    super();
    this.baseUrl = 'https://www.eventbrite.com';
    this.searchUrl = 'https://www.eventbrite.com/d/sandpoint--id/events/';
    this.source = 'Eventbrite';
  }

  async scrapeEvents(location = 'Sandpoint, ID', radius = 25) {
    console.log(`Scraping events from ${this.source} for ${location}...`);
    
    try {
      // Use Puppeteer for dynamic content
      console.log(`Navigating to: ${this.searchUrl}`);
      const { $ } = await this.scrapeWithPuppeteer(this.searchUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
        skipWaitForSelector: true // Don't wait for specific selector
      });

      const events = [];
      
      // PRIORITIZE JSON-LD extraction first for structured data
      console.log('Extracting structured data from JSON-LD...');
      const jsonLdData = this.extractJsonLd($);
      const structuredEvents = this.extractEventbriteFromJsonLd(jsonLdData);
      events.push(...structuredEvents);
      console.log(`Found ${structuredEvents.length} events from JSON-LD structured data`);

      // Debug: Check what's actually on the page
      console.log('Analyzing page structure...');
      console.log(`Page title: ${$('title').text()}`);
      console.log(`Total elements on page: ${$('*').length}`);
      
      // Try multiple selector patterns to find event elements
      const selectorTests = [
        '.eds-event-card-content',
        '[data-testid="event-card"]', 
        '.search-results-list-item',
        '.event-card',
        '[class*="event"]',
        '[class*="card"]',
        'article',
        '[data-spec*="event"]'
      ];
      
      console.log('Testing selectors:');
      selectorTests.forEach(selector => {
        const found = $(selector);
        console.log(`  ${selector}: ${found.length} elements`);
      });

      // Then fall back to HTML parsing for any missed events
      console.log('Extracting from HTML elements...');
      const eventCards = $('.eds-event-card-content, [data-testid="event-card"], .search-results-list-item, .event-card, [class*="event"], article');
      console.log(`Found ${eventCards.length} potential HTML event cards`);

      eventCards.each((index, element) => {
        try {
          // Debug first 3 event cards to see their structure
          if (index < 3) {
            console.log(`\nDebug Event Card ${index + 1}:`);
            console.log(`HTML: ${$(element).html()?.substring(0, 300)}...`);
            console.log(`Classes: ${$(element).attr('class') || 'none'}`);
          }
          
          const eventData = this.extractEventbriteEventData($, $(element));
          
          // Debug event data extraction
          if (index < 3) {
            console.log(`Extracted data:`, eventData);
          }
          
          if (eventData.title && (eventData.date || eventData.startDate)) {
            // Filter for Sandpoint area events
            if (this.isInSandpointArea(eventData)) {
              const normalizedEvent = this.normalizeEvent(eventData, this.source);
              events.push(normalizedEvent);
            } else {
              console.log(`Event filtered out (not in Sandpoint area): ${eventData.title}`);
            }
          } else {
            if (index < 5) {
              console.log(`Event skipped - missing title or date:`, {
                title: eventData.title,
                date: eventData.date,
                startDate: eventData.startDate
              });
            }
          }
        } catch (error) {
          console.warn(`Skipping invalid Eventbrite event: ${error.message}`);
        }
      });

      const filteredEvents = this.removeDuplicates(events);
      
      // Count events that need review
      const needsReviewCount = filteredEvents.filter(event => event.needsReview).length;
      
      console.log(`Successfully scraped ${filteredEvents.length} events from ${this.source}`);
      console.log(`Events requiring review: ${needsReviewCount}/${filteredEvents.length}`);
      
      // Save events to file
      const filename = `eventbrite-${new Date().toISOString().split('T')[0]}.json`;
      await this.saveEvents(filteredEvents, filename);
      
      return filteredEvents;
    } catch (error) {
      console.error(`Error scraping ${this.source}:`, error);
      return [];
    }
  }

  extractEventbriteEventData($, $element) {
    const eventData = {};

    // Title
    const titleSelectors = [
      '.eds-event-card__title',
      '.eds-event-card__title a',
      '[data-spec="event-title"]',
      '.event-title',
      '.title-link',
      'h3 a',
      '.summary-display-title'
    ];
    
    for (const selector of titleSelectors) {
      const titleEl = $element.find(selector).first();
      if (titleEl.length && titleEl.text().trim()) {
        eventData.title = titleEl.text().trim();
        
        // Also get URL from title link
        const href = titleEl.attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          eventData.url = fullUrl;
          eventData.referenceUrl = fullUrl; // Original event URL for reference
          // For Eventbrite, the event URL is also the ticket URL
          eventData.ticketUrl = fullUrl;
        }
      }
    }
    

    // Date and time
    const dateSelectors = [
      '.eds-event-card__date',
      '[data-start-time]',
      '[data-spec="event-datetime"]',
      '.event-datetime',
      '.date-display',
      'time',
      '.starts-at'
    ];

    for (const selector of dateSelectors) {
      const dateEl = $element.find(selector).first();
      if (dateEl.length) {
        eventData.date = dateEl.attr('datetime') || 
                         dateEl.attr('content') ||
                         dateEl.text().trim();
        if (eventData.date) break;
      }
    }

    // Location/Venue
    const locationSelectors = [
      '.eds-event-card__venue',
      '.eds-event-card__venue-name',
      '[data-spec="event-location"]',
      '.event-location',
      '.location-display',
      '.venue-name',
      '.location-info'
    ];

    for (const selector of locationSelectors) {
      const locationEl = $element.find(selector).first();
      if (locationEl.length && locationEl.text().trim()) {
        const locationText = locationEl.text().trim();
        eventData.venue = locationText;
        eventData.location = locationText;
        break;
      }
    }

    // Description
    const descSelectors = [
      '.eds-event-card__description',
      '.event-description',
      '.summary-display-description',
      '.event-summary'
    ];

    for (const selector of descSelectors) {
      const descEl = $element.find(selector).first();
      if (descEl.length && descEl.text().trim()) {
        eventData.description = descEl.text().trim().substring(0, 500);
        break;
      }
    }

    // Image - prioritize high-quality event images
    const imageSelectors = [
      '.eds-event-card__image img',
      '.event-image img',
      '.event-card-image img',
      '.listing-hero-image img',
      '.event-logo img',
      'img[alt*="event"]',
      'img[src*="event"]',
      '.eds-media-hero__image img',
      '.listing-hero img',
      'img'
    ];
    
    for (const selector of imageSelectors) {
      const imgEl = $element.find(selector).first();
      if (imgEl.length) {
        let imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src');
        
        if (imgSrc) {
          // Skip very small images or placeholders
          const width = imgEl.attr('width') || imgEl.css('width');
          const height = imgEl.attr('height') || imgEl.css('height');
          
          // Skip if dimensions are too small (likely icons)
          if ((width && parseInt(width) < 100) || (height && parseInt(height) < 100)) {
            continue;
          }
          
          // Skip generic placeholder images
          if (imgSrc.includes('placeholder') || imgSrc.includes('default') || 
              imgSrc.includes('avatar') || imgSrc.includes('logo')) {
            continue;
          }
          
          // Ensure absolute URL
          if (!imgSrc.startsWith('http')) {
            if (imgSrc.startsWith('//')) {
              imgSrc = 'https:' + imgSrc;
            } else {
              imgSrc = imgSrc.startsWith('/') ? `${this.baseUrl}${imgSrc}` : `${this.baseUrl}/${imgSrc}`;
            }
          }
          
          eventData.image = imgSrc;
          break;
        }
      }
    }

    // Price information
    const priceSelectors = [
      '.event-price',
      '.price-display',
      '[data-spec="event-price"]'
    ];

    for (const selector of priceSelectors) {
      const priceEl = $element.find(selector).first();
      if (priceEl.length && priceEl.text().trim()) {
        eventData.price = priceEl.text().trim();
        break;
      }
    }
    
    // Look for specific ticket/register buttons if not already found
    if (!eventData.ticketUrl) {
      const ticketSelectors = [
        '.eds-btn--link',
        'a[href*="/checkout-external"]',
        'a[href*="tickets"]',
        'a[href*="register"]',
        '.ticket-button a',
        '.register-button a',
        'a:contains("Get Tickets")',
        'a:contains("Register")',
        'a:contains("Buy Now")'
      ];
      
      for (const selector of ticketSelectors) {
        const ticketEl = $element.find(selector).first();
        if (ticketEl.length) {
          const ticketHref = ticketEl.attr('href');
          if (ticketHref) {
            eventData.ticketUrl = ticketHref.startsWith('http') ? ticketHref : `${this.baseUrl}${ticketHref}`;
            break;
          }
        }
      }
    }

    // Tags/Categories
    const tagSelectors = [
      '.event-tags',
      '.category-display',
      '.event-category'
    ];

    for (const selector of tagSelectors) {
      const tagEl = $element.find(selector);
      if (tagEl.length) {
        const tags = [];
        tagEl.each((i, el) => {
          const tag = $(el).text().trim();
          if (tag) tags.push(tag);
        });
        if (tags.length > 0) {
          eventData.tags = tags;
          break;
        }
      }
    }
    
    // If we have a URL but no ticketUrl, set ticketUrl to URL for Eventbrite
    if (eventData.url && !eventData.ticketUrl) {
      eventData.ticketUrl = eventData.url;
    }
    
    // Set referenceUrl if not already set
    if (eventData.url && !eventData.referenceUrl) {
      eventData.referenceUrl = eventData.url;
    }

    // Extract time information from date strings
    const timeInfo = this.extractTimeFromDates(eventData.date, eventData.endDate);
    eventData.startTime = timeInfo.startTime;
    eventData.endTime = timeInfo.endTime;
    eventData.startDate = eventData.date;

    // Handle location ambiguity
    const locationInfo = this.processLocationData(eventData.venue, eventData.location);
    eventData.venue = locationInfo.venue;
    eventData.locationNote = locationInfo.locationNote;

    // Determine if needs review
    eventData.needsReview = this.shouldMarkForReview(eventData);

    return eventData;
  }

  extractEventbriteFromJsonLd(jsonLdData) {
    const events = [];

    for (const data of jsonLdData) {
      try {
        if (data['@type'] === 'Event' || (data['@graph'] && Array.isArray(data['@graph']))) {
          const eventItems = data['@graph'] ? data['@graph'].filter(item => item['@type'] === 'Event') : [data];
          
          for (const eventItem of eventItems) {
            const eventData = {
              title: eventItem.name,
              description: eventItem.description,
              startDate: eventItem.startDate,
              endDate: eventItem.endDate,
              date: eventItem.startDate, // Keep for backward compatibility
              url: eventItem.url,
              referenceUrl: eventItem.url, // Original event URL for reference
              ticketUrl: eventItem.url || // Eventbrite event URLs are ticket URLs
                        eventItem.offers?.url ||
                        (Array.isArray(eventItem.offers) ? eventItem.offers[0]?.url : null),
              venue: eventItem.location?.name || eventItem.location?.address?.addressLocality,
              location: eventItem.location?.address ? 
                `${eventItem.location.address.addressLocality}, ${eventItem.location.address.addressRegion}` : 
                eventItem.location?.name,
              image: eventItem.image?.url || eventItem.image,
              price: eventItem.offers?.price || eventItem.offers?.lowPrice ||
                    (Array.isArray(eventItem.offers) ? eventItem.offers[0]?.price : null),
              performer: eventItem.performer,
              organizer: eventItem.organizer
            };

            // Extract time information from dates
            const timeInfo = this.extractTimeFromDates(eventData.startDate, eventData.endDate);
            eventData.startTime = timeInfo.startTime;
            eventData.endTime = timeInfo.endTime;

            // Handle location ambiguity
            const locationInfo = this.processLocationData(eventData.venue, eventData.location);
            eventData.venue = locationInfo.venue;
            eventData.locationNote = locationInfo.locationNote;

            // Determine if needs review
            eventData.needsReview = this.shouldMarkForReview(eventData);

            if (eventData.title && eventData.startDate && this.isInSandpointArea(eventData)) {
              const normalizedEvent = this.normalizeEvent(eventData, this.source);
              events.push(normalizedEvent);
            }
          }
        }
      } catch (error) {
        console.warn(`Skipping invalid Eventbrite JSON-LD event: ${error.message}`);
      }
    }

    return events;
  }

  isInSandpointArea(eventData) {
    const location = (eventData.location || eventData.venue || '').toLowerCase();
    const sandpointKeywords = [
      'sandpoint',
      'coeur d\'alene', // nearby city
      'post falls', // nearby city
      'bonner county',
      'kootenai county',
      'north idaho',
      'idaho panhandle'
    ];

    return sandpointKeywords.some(keyword => location.includes(keyword)) || 
           location.includes('id') || 
           location.includes('idaho');
  }

  removeDuplicates(events) {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.title.toLowerCase()}-${event.date}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract time information from date strings
   * Note: This extracts the local time from the date, assuming the event date/time
   * provided is already in the correct timezone for the event
   */
  extractTimeFromDates(startDate, endDate) {
    const result = {
      startTime: null,
      endTime: null
    };

    if (startDate) {
      try {
        const start = new Date(startDate);
        if (!isNaN(start)) {
          // Use local time representation for the event
          // Format as HH:MM in 24-hour format
          const hours = start.getHours().toString().padStart(2, '0');
          const minutes = start.getMinutes().toString().padStart(2, '0');
          result.startTime = `${hours}:${minutes}`;
        }
      } catch (e) {
        // Invalid date, leave as null
      }
    }

    if (endDate) {
      try {
        const end = new Date(endDate);
        if (!isNaN(end)) {
          // Use local time representation for the event
          // Format as HH:MM in 24-hour format
          const hours = end.getHours().toString().padStart(2, '0');
          const minutes = end.getMinutes().toString().padStart(2, '0');
          result.endTime = `${hours}:${minutes}`;
        }
      } catch (e) {
        // Invalid date, leave as null
      }
    }

    return result;
  }

  /**
   * Process location data to distinguish between venue and ambiguous locations
   */
  processLocationData(venue, location) {
    const result = {
      venue: null,
      locationNote: null
    };

    // If we have a clear venue name, use it
    if (venue && typeof venue === 'string' && venue.trim()) {
      const cleanVenue = venue.trim();
      
      // Check if it looks like a proper venue name vs. generic location
      const genericLocationTerms = [
        'downtown', 'online', 'virtual', 'tbd', 'to be determined', 
        'various locations', 'multiple venues', 'citywide'
      ];
      
      const isGenericLocation = genericLocationTerms.some(term => 
        cleanVenue.toLowerCase().includes(term)
      );
      
      if (isGenericLocation) {
        result.locationNote = cleanVenue;
      } else {
        result.venue = cleanVenue;
      }
    } else if (location && typeof location === 'string' && location.trim()) {
      // If no venue but we have location info, put it in locationNote
      result.locationNote = location.trim();
    }

    return result;
  }

  /**
   * Determine if an event should be marked for review
   * ACCURACY ENFORCEMENT: Mark for review instead of fabricating missing data
   */
  shouldMarkForReview(eventData) {
    const reasons = [];

    // No time information found - NEVER guess times
    if (!eventData.startTime && !eventData.endTime) {
      reasons.push('missing_time');
    }

    // No image found - NEVER use placeholder or fake images
    if (!eventData.image) {
      reasons.push('missing_image');
    }

    // Venue information is ambiguous (has locationNote but no venue)
    if (eventData.locationNote && !eventData.venue) {
      reasons.push('ambiguous_venue');
    }

    // No venue and no location note - completely missing location info
    if (!eventData.venue && !eventData.locationNote) {
      reasons.push('missing_location');
    }

    // For music events, check if performer info is missing
    if (eventData.title && eventData.description) {
      const text = `${eventData.title} ${eventData.description}`.toLowerCase();
      const musicKeywords = ['concert', 'music', 'band', 'singer', 'performance', 'live music', 'artist'];
      const isLikelyMusicEvent = musicKeywords.some(keyword => text.includes(keyword));
      
      if (isLikelyMusicEvent && !eventData.performer) {
        reasons.push('missing_performer_info');
      }
    }

    // No description or very short description
    if (!eventData.description || eventData.description.trim().length < 10) {
      reasons.push('incomplete_description');
    }

    // No reference URL - should always have source
    if (!eventData.referenceUrl && !eventData.url) {
      reasons.push('missing_reference_url');
    }

    // ACCURACY ENFORCEMENT: Mark for review if any critical issues found
    // Better to have human review than to fabricate data
    return reasons.length > 0;
  }

  async scrapeEventbriteWithAPI(token, location = 'Sandpoint, ID') {
    // If Eventbrite API token is available, use API instead of scraping
    if (!token) {
      console.log('No Eventbrite API token provided, using web scraping...');
      return this.scrapeEvents();
    }

    try {
      const apiUrl = `https://www.eventbriteapi.com/v3/events/search/?location.address=${encodeURIComponent(location)}&location.within=25mi&expand=venue,organizer&token=${token}`;
      
      const response = await axios.get(apiUrl);
      const events = response.data.events?.map(event => {
        const eventData = {
          title: event.name?.text,
          description: event.description?.text,
          startDate: event.start?.utc,
          endDate: event.end?.utc,
          date: event.start?.utc, // Backward compatibility
          url: event.url,
          referenceUrl: event.url,
          ticketUrl: event.url, // Eventbrite event URLs are ticket purchase URLs
          venue: event.venue?.name,
          location: `${event.venue?.address?.city || ''}, ${event.venue?.address?.region || ''}`.trim().replace(/^,\s*/, ''),
          image: event.logo?.url,
          price: event.ticket_classes?.[0]?.cost ? `$${event.ticket_classes[0].cost.display}` : null,
          tags: event.category ? [event.category.name] : [],
          organizer: event.organizer?.name
        };

        // Extract time information from API dates
        const timeInfo = this.extractTimeFromDates(eventData.startDate, eventData.endDate);
        eventData.startTime = timeInfo.startTime;
        eventData.endTime = timeInfo.endTime;

        // Process location data
        const locationInfo = this.processLocationData(eventData.venue, eventData.location);
        eventData.venue = locationInfo.venue;
        eventData.locationNote = locationInfo.locationNote;

        // Check if needs review
        eventData.needsReview = this.shouldMarkForReview(eventData);

        return this.normalizeEvent(eventData, this.source);
      }) || [];

      console.log(`Successfully scraped ${events.length} events from Eventbrite API`);
      
      // Save events to file
      const filename = `eventbrite-api-${new Date().toISOString().split('T')[0]}.json`;
      await this.saveEvents(events, filename);
      
      return events;
    } catch (error) {
      console.error('Error using Eventbrite API, falling back to web scraping:', error.message);
      return this.scrapeEvents();
    }
  }
}

module.exports = EventbriteScraper;

// CLI execution
if (require.main === module) {
  const scraper = new EventbriteScraper();
  
  console.log('Starting Eventbrite scraper...');
  console.log('Source:', scraper.source);
  console.log('Base URL:', scraper.baseUrl);
  console.log('');
  
  scraper.scrapeEvents()
    .then(events => {
      console.log(`\n✅ Eventbrite scraping completed successfully!`);
      console.log(`📊 Events found: ${events.length}`);
      console.log(`📁 Events saved to session directory`);
      
      if (events.length > 0) {
        console.log('\n📋 Sample events:');
        events.slice(0, 3).forEach((event, i) => {
          console.log(`${i + 1}. ${event.title}`);
          console.log(`   Date: ${event.startDate || event.date}`);
          console.log(`   Time: ${event.startTime || 'TBD'}`);
          console.log(`   Venue: ${event.venue?.name || event.venue || 'TBD'}`);
          console.log(`   Needs Review: ${event.needsReview ? 'Yes' : 'No'}`);
          console.log('');
        });
      }
    })
    .catch(error => {
      console.error('❌ Eventbrite scraping failed:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    });
}