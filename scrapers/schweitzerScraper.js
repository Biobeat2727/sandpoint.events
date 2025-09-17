const EventScraper = require('../utils/eventScraper');
const axios = require('axios');

class SchweitzerScraper extends EventScraper {
  constructor() {
    super();
    this.baseUrl = 'https://www.schweitzer.com';
    this.eventsUrl = 'https://www.schweitzer.com/things-to-do/events';
    this.activitiesUrl = 'https://www.schweitzer.com/things-to-do/activities';
    this.source = 'Schweitzer Mountain Resort';
    
    // Schweitzer-specific venues and locations
    this.knownVenues = {
      'village': 'Schweitzer Village',
      'base lodge': 'Schweitzer Base Lodge',
      'summit': 'Schweitzer Summit',
      'crow\'s bench': 'Crow\'s Bench',
      'village lawn': 'Village Lawn',
      'mountain': 'Schweitzer Mountain',
      'resort': 'Schweitzer Mountain Resort'
    };
  }

  async scrapeEvents() {
    console.log(`Scraping events from ${this.source}...`);
    
    try {
      const allEvents = [];
      
      // 1. PRIORITIZE JSON-LD structured data extraction first
      console.log('Step 1: Extracting structured data from main events page...');
      const eventsPageData = await this.scrapeEventsPage();
      allEvents.push(...eventsPageData);
      
      console.log('Step 2: Extracting structured data from activities page...');
      const activitiesPageData = await this.scrapeActivitiesPage();
      allEvents.push(...activitiesPageData);
      
      // 3. Additional pages that might have events
      console.log('Step 3: Checking for additional event sources...');
      const additionalEvents = await this.scrapeAdditionalSources();
      allEvents.push(...additionalEvents);
      
      const filteredEvents = this.removeDuplicates(allEvents);
      
      // Count events that need review
      const needsReviewCount = filteredEvents.filter(event => event.needsReview).length;
      
      console.log(`Successfully scraped ${filteredEvents.length} events from ${this.source}`);
      console.log(`Events requiring review: ${needsReviewCount}/${filteredEvents.length}`);
      
      // Save events to file
      const filename = `schweitzer-${new Date().toISOString().split('T')[0]}.json`;
      await this.saveEvents(filteredEvents, filename);
      
      // Finalize session
      await this.finalizeSession({
        eventsFound: filteredEvents.length,
        needsReview: needsReviewCount,
        source: this.source
      });
      
      return filteredEvents;
    } catch (error) {
      console.error(`Error scraping ${this.source}:`, error);
      return [];
    }
  }

  async scrapeEventsPage() {
    const events = [];
    
    try {
      // Use Puppeteer for dynamic content
      const { $ } = await this.scrapeWithPuppeteer(this.eventsUrl, {
        waitForSelector: '.event-results, .placeholder-item, .image-cta',
        timeout: 30000
      });

      console.log('Extracting structured data from JSON-LD...');
      const jsonLdData = this.extractJsonLd($);
      const structuredEvents = this.extractSchweitzerFromJsonLd(jsonLdData);
      events.push(...structuredEvents);
      console.log(`Found ${structuredEvents.length} events from JSON-LD structured data`);

      // HTML parsing fallback - multiple strategies
      console.log('Extracting from HTML elements...');
      
      // Strategy 1: Direct event links with proper parents
      const eventLinks = $('a[href*="/things-to-do/events/"]').filter((i, link) => {
        const $link = $(link);
        const parent = $link.parent();
        
        // Skip menu/navigation links
        if (parent.hasClass('header-menu-submenu-link') || 
            $link.hasClass('header-menu-submenu-link') ||
            parent.closest('nav').length > 0 ||
            parent.closest('.navigation').length > 0) {
          return false;
        }
        
        // Include links that are part of event listings
        return parent.hasClass('placeholder-item') || 
               parent.hasClass('result') ||
               $link.hasClass('image-cta') ||
               parent.find('img').length > 0; // Has event image
      });
      
      console.log(`Found ${eventLinks.length} direct event links`);

      const processedUrls = new Set(); // Prevent duplicate processing

      eventLinks.each((index, element) => {
        try {
          const $element = $(element);
          const href = $element.attr('href');
          
          // Skip if we've already processed this URL
          if (processedUrls.has(href)) {
            return;
          }
          processedUrls.add(href);
          
          const eventData = this.extractSchweitzerEventFromLink($, $element);
          if (eventData && eventData.title && eventData.url) {
            // For Schweitzer, we may not have dates on listing page, so create a placeholder date
            if (!eventData.date && !eventData.startDate) {
              eventData.date = new Date().toISOString(); // Use current date as placeholder
              eventData.startDate = new Date().toISOString(); 
              eventData.needsReview = true;
            }
            
            const normalizedEvent = this.normalizeEvent(eventData, this.source);
            events.push(normalizedEvent);
            console.log(`✅ Extracted event: "${eventData.title}"`);
          } else {
            console.log(`❌ Incomplete event data: title="${eventData?.title}", url="${eventData?.url}"`);
          }
        } catch (error) {
          console.warn(`Skipping invalid Schweitzer event: ${error.message}`);
        }
      });

      return events;
    } catch (error) {
      console.error(`Error scraping events page: ${error.message}`);
      return [];
    }
  }

  async scrapeActivitiesPage() {
    const events = [];
    
    try {
      // Activities often have scheduled sessions/events
      const { $ } = await this.scrapeWithPuppeteer(this.activitiesUrl, {
        waitForSelector: '.placeholder-item, .content-card, .activity-listing',
        timeout: 30000
      });

      console.log('Extracting activities with scheduled times...');
      const activityCards = $('.placeholder-item, .content-card, .activity-listing');
      console.log(`Found ${activityCards.length} potential activity cards`);

      activityCards.each((index, element) => {
        try {
          const activityData = this.extractSchweitzerActivityData($, $(element));
          if (activityData && activityData.title && activityData.hasScheduledTimes) {
            // Convert activity with scheduled times to event
            const eventData = this.convertActivityToEvent(activityData);
            const normalizedEvent = this.normalizeEvent(eventData, this.source);
            events.push(normalizedEvent);
          }
        } catch (error) {
          console.warn(`Skipping invalid Schweitzer activity: ${error.message}`);
        }
      });

      return events;
    } catch (error) {
      console.error(`Error scraping activities page: ${error.message}`);
      return [];
    }
  }

  async scrapeAdditionalSources() {
    const events = [];
    
    // Additional URLs that might contain events
    const additionalUrls = [
      `${this.baseUrl}/summer-activities`,
      `${this.baseUrl}/winter-activities`,
      `${this.baseUrl}/news-events`,
      `${this.baseUrl}/calendar`
    ];

    for (const url of additionalUrls) {
      try {
        console.log(`Checking additional source: ${url}`);
        const { $ } = await this.scrapeWithCheerio(url);
        
        const jsonLdData = this.extractJsonLd($);
        const structuredEvents = this.extractSchweitzerFromJsonLd(jsonLdData);
        events.push(...structuredEvents);
        
        // Look for event-like content
        const eventElements = $('.event, .calendar-item, .news-item');
        eventElements.each((index, element) => {
          try {
            const eventData = this.extractSchweitzerEventData($, $(element));
            if (eventData.title && (eventData.date || eventData.startDate)) {
              const normalizedEvent = this.normalizeEvent(eventData, this.source);
              events.push(normalizedEvent);
            }
          } catch (error) {
            // Skip invalid entries
          }
        });
        
      } catch (error) {
        // URL might not exist, continue with others
        console.log(`Could not access ${url}, continuing...`);
      }
    }

    return events;
  }

  extractSchweitzerEventData($, $element) {
    const eventData = {};

    // Title extraction - Schweitzer uses links and image alt text
    let title = null;
    
    // Try to get title from link href (URL path)
    const linkEl = $element.is('a') ? $element : $element.find('a').first();
    if (linkEl.length) {
      const href = linkEl.attr('href');
      if (href) {
        // Extract title from URL path like "/things-to-do/events/2-movies-on-the-mountain"
        const pathParts = href.split('/').filter(part => part.length > 0);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== 'events') {
          // Convert URL slug to title
          title = lastPart
            .replace(/^\d+-/, '') // Remove leading numbers
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        }
      }
    }

    // Try to get title from image alt text
    if (!title) {
      const imgEl = $element.find('img').first();
      if (imgEl.length) {
        const altText = imgEl.attr('alt');
        if (altText && altText.length > 10) {
          title = this.cleanText(altText);
        }
      }
    }
    
    // Fallback to traditional selectors
    if (!title) {
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4',
        '.event-title', '.card-title', '.content-title',
        '.activity-title', '.program-title',
        '[data-title]', '.title'
      ];
      
      for (const selector of titleSelectors) {
        const titleEl = $element.find(selector).first();
        if (titleEl.length && titleEl.text().trim()) {
          title = this.cleanText(titleEl.text());
          break;
        }
      }
    }
    
    if (title) {
      eventData.title = title;
    }

    // Date and time extraction - Schweitzer uses various formats
    const dateSelectors = [
      '.event-date', '.date', '.event-time', '.time',
      '[data-date]', '[data-time]', '[datetime]',
      '.calendar-date', '.schedule-date'
    ];

    for (const selector of dateSelectors) {
      const dateEl = $element.find(selector).first();
      if (dateEl.length) {
        const dateText = dateEl.attr('datetime') || 
                         dateEl.attr('data-date') ||
                         dateEl.attr('content') ||
                         dateEl.text().trim();
        if (dateText) {
          eventData.date = dateText;
          eventData.startDate = dateText;
          break;
        }
      }
    }

    // Enhanced time extraction for start/end times
    const timeInfo = this.extractSchweitzerTimeInfo($element);
    if (timeInfo.startTime) eventData.startTime = timeInfo.startTime;
    if (timeInfo.endTime) eventData.endTime = timeInfo.endTime;
    if (timeInfo.endDate) eventData.endDate = timeInfo.endDate;

    // Description
    const descSelectors = [
      '.event-description', '.description', '.content',
      '.event-summary', '.summary', '.excerpt',
      '.card-text', '.activity-description', 'p'
    ];

    for (const selector of descSelectors) {
      const descEl = $element.find(selector).first();
      if (descEl.length && descEl.text().trim()) {
        const descText = this.cleanText(descEl.text());
        if (descText.length > 20) { // Avoid short/generic text
          eventData.description = descText.substring(0, 500);
          break;
        }
      }
    }

    // Location/Venue - specific to Schweitzer locations
    const locationSelectors = [
      '.location', '.venue', '.event-location',
      '.activity-location', '[data-location]',
      '.where', '.place'
    ];

    for (const selector of locationSelectors) {
      const locationEl = $element.find(selector).first();
      if (locationEl.length && locationEl.text().trim()) {
        const locationText = this.cleanText(locationEl.text());
        eventData.location = locationText;
        
        // Process Schweitzer-specific venue information
        const venueInfo = this.processSchweitzerLocation(locationText);
        eventData.venue = venueInfo.venue;
        eventData.locationNote = venueInfo.locationNote;
        break;
      }
    }

    // Image extraction - prioritize event-specific images
    const imageSelectors = [
      '.event-image img', '.hero-image img', '.feature-image img',
      '.card-img img', '.activity-image img', '.program-image img',
      'img[alt*="event"]', 'img[alt*="activity"]', 'img'
    ];
    
    for (const selector of imageSelectors) {
      const imgEl = $element.find(selector).first();
      if (imgEl.length) {
        let imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src');
        
        if (imgSrc) {
          // Skip very small images
          const width = imgEl.attr('width') || imgEl.css('width');
          const height = imgEl.attr('height') || imgEl.css('height');
          
          if ((width && parseInt(width) < 200) || (height && parseInt(height) < 200)) {
            continue;
          }
          
          // Skip generic images
          if (imgSrc.includes('logo') || imgSrc.includes('icon') || 
              imgSrc.includes('placeholder') || imgSrc.includes('default')) {
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

    // URL/Link extraction - use the link we found during title extraction
    if (linkEl && linkEl.length) {
      let href = linkEl.attr('href');
      if (href) {
        if (!href.startsWith('http')) {
          href = href.startsWith('/') ? `${this.baseUrl}${href}` : `${this.baseUrl}/${href}`;
        }
        eventData.url = href;
        eventData.referenceUrl = href;
      }
    }

    // Ticket information - Schweitzer might have registration or ticket links
    const ticketSelectors = [
      'a[href*="ticket"]', 'a[href*="register"]', 'a[href*="book"]',
      '.ticket-button', '.register-button', '.book-button',
      'a:contains("Register")', 'a:contains("Book")', 'a:contains("Tickets")'
    ];

    for (const selector of ticketSelectors) {
      const ticketEl = $element.find(selector).first();
      if (ticketEl.length) {
        let ticketHref = ticketEl.attr('href');
        if (ticketHref) {
          if (!ticketHref.startsWith('http')) {
            ticketHref = ticketHref.startsWith('/') ? `${this.baseUrl}${ticketHref}` : `${this.baseUrl}/${ticketHref}`;
          }
          eventData.ticketUrl = ticketHref;
          break;
        }
      }
    }

    // Price information
    const priceSelectors = [
      '.price', '.cost', '.fee', '[data-price]',
      '.event-price', '.activity-price'
    ];

    for (const selector of priceSelectors) {
      const priceEl = $element.find(selector).first();
      if (priceEl.length && priceEl.text().trim()) {
        eventData.price = this.cleanText(priceEl.text());
        break;
      }
    }

    // Tags/Categories - Schweitzer specific
    const tagSelectors = [
      '.tags', '.categories', '.event-type', '.activity-type',
      '[data-category]', '.label', '.badge'
    ];

    const tags = [];
    for (const selector of tagSelectors) {
      const tagEls = $element.find(selector);
      tagEls.each((i, el) => {
        const tag = this.cleanText($(el).text());
        if (tag && tag.length > 1) {
          tags.push(tag);
        }
      });
    }
    
    if (tags.length > 0) {
      eventData.tags = tags;
    }

    // If no URL set, use current page as reference
    if (!eventData.referenceUrl) {
      eventData.referenceUrl = this.eventsUrl;
    }
    
    // For Schweitzer, since we might not get dates from the listing page,
    // we should scrape individual event pages for complete information
    // Mark for review if missing critical information
    if (!eventData.date && !eventData.startDate) {
      eventData.needsReview = true;
      eventData.locationNote = 'Event date to be confirmed - check event page';
    }

    // Determine if needs review based on Schweitzer-specific criteria
    eventData.needsReview = this.shouldSchweitzerMarkForReview(eventData);

    return eventData;
  }

  extractSchweitzerEventFromLink($, $linkElement) {
    const eventData = {};
    
    // Get the URL first
    const href = $linkElement.attr('href');
    if (href) {
      eventData.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      eventData.referenceUrl = eventData.url;
    }
    
    // Extract title from URL slug if available
    if (href) {
      const pathParts = href.split('/').filter(part => part.length > 0);
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart !== 'events') {
        // Convert URL slug to title
        let title = lastPart
          .replace(/^\d+-/, '') // Remove leading numbers
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        
        // Clean up specific Schweitzer event titles
        if (title.toLowerCase().includes('movies on the mountain')) {
          title = 'Movies on the Mountain';
        }
        
        eventData.title = title;
      }
    }
    
    // Try to get title from link text if URL method didn't work well
    if (!eventData.title || eventData.title.length < 5) {
      const linkText = $linkElement.text().trim();
      if (linkText && linkText.length > 5 && !linkText.includes('\n')) {
        eventData.title = this.cleanText(linkText);
      }
    }
    
    // Look for images in the parent container or link itself
    const parentContainer = $linkElement.closest('.placeholder-item, .result, .event');
    const images = parentContainer.find('img').add($linkElement.find('img'));
    
    if (images.length > 0) {
      const imgEl = images.first();
      let imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src');
      
      if (imgSrc) {
        // Skip very small images
        const width = imgEl.attr('width') || imgEl.css('width');
        const height = imgEl.attr('height') || imgEl.css('height');
        
        if (!((width && parseInt(width) < 200) || (height && parseInt(height) < 200))) {
          // Skip generic images
          if (!imgSrc.includes('logo') && !imgSrc.includes('icon') && 
              !imgSrc.includes('placeholder') && !imgSrc.includes('default')) {
            
            // Ensure absolute URL
            if (!imgSrc.startsWith('http')) {
              if (imgSrc.startsWith('//')) {
                imgSrc = 'https:' + imgSrc;
              } else {
                imgSrc = imgSrc.startsWith('/') ? `${this.baseUrl}${imgSrc}` : `${this.baseUrl}/${imgSrc}`;
              }
            }
            
            eventData.image = imgSrc;
          }
        }
      }
      
      // Also try to get description from image alt text
      const altText = imgEl.attr('alt');
      if (altText && altText.length > 20 && !eventData.description) {
        eventData.description = this.cleanText(altText);
      }
    }
    
    // Look for date information in parent container
    const dateText = parentContainer.text();
    const datePatterns = [
      /Aug(?:ust)?\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?/gi,
      /Sep(?:tember)?\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?/gi,
      /Oct(?:ober)?\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?/gi,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi
    ];
    
    for (const pattern of datePatterns) {
      const match = dateText.match(pattern);
      if (match) {
        eventData.dateText = match[0];
        // For now, just store the date text - could parse into actual date later
        break;
      }
    }
    
    // Look for time information
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(AM|PM)/gi,
      /(\d{1,2})\s*(AM|PM)/gi
    ];
    
    for (const pattern of timePatterns) {
      const match = dateText.match(pattern);
      if (match) {
        eventData.timeText = match[0];
        break;
      }
    }
    
    // Set default venue to Schweitzer Mountain Resort
    eventData.venue = 'Schweitzer Mountain Resort';
    
    // Look for specific venue information
    const venueKeywords = ['base lodge', 'village', 'summit', 'crow\'s bench'];
    const lowerText = dateText.toLowerCase();
    
    for (const keyword of venueKeywords) {
      if (lowerText.includes(keyword)) {
        const venueInfo = this.processSchweitzerLocation(keyword);
        if (venueInfo.venue) {
          eventData.venue = venueInfo.venue;
        }
        break;
      }
    }
    
    // Default description based on title if none found
    if (!eventData.description && eventData.title) {
      if (eventData.title.toLowerCase().includes('movie')) {
        eventData.description = 'Free outdoor movie screening at Schweitzer Mountain Resort';
      } else if (eventData.title.toLowerCase().includes('concert') || eventData.title.toLowerCase().includes('sound')) {
        eventData.description = 'Live music performance at Schweitzer Mountain Resort';
      } else if (eventData.title.toLowerCase().includes('fall fest')) {
        eventData.description = 'Annual Fall Festival with food, drinks, and activities';
      }
    }
    
    // Determine if needs review
    eventData.needsReview = this.shouldSchweitzerMarkForReview(eventData);
    
    return eventData;
  }

  extractSchweitzerActivityData($, $element) {
    // Similar to event extraction but focused on scheduled activities
    const activityData = {
      hasScheduledTimes: false
    };

    // Check if this activity has scheduled times/sessions
    const timeIndicators = [
      'schedule', 'times', 'sessions', 'daily', 'hourly',
      'am', 'pm', 'morning', 'afternoon', 'evening'
    ];

    const elementText = $element.text().toLowerCase();
    activityData.hasScheduledTimes = timeIndicators.some(indicator => 
      elementText.includes(indicator)
    );

    if (!activityData.hasScheduledTimes) {
      return null;
    }

    // Extract activity data similar to event extraction
    return this.extractSchweitzerEventData($, $element);
  }

  convertActivityToEvent(activityData) {
    // Convert activity with scheduled times to event format
    const eventData = { ...activityData };
    
    // If no specific date, assume it's recurring/ongoing
    if (!eventData.date && !eventData.startDate) {
      eventData.needsReview = true;
      eventData.locationNote = eventData.locationNote || 'Scheduled activity - check website for current times';
    }

    return eventData;
  }

  extractSchweitzerTimeInfo($element) {
    const timeInfo = {
      startTime: null,
      endTime: null,
      endDate: null
    };

    // Look for time patterns in text
    const textContent = $element.text();
    
    // Common time patterns
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/gi,
      /(\d{1,2})\s*(AM|PM)\s*-\s*(\d{1,2})\s*(AM|PM)/gi,
      /(\d{1,2}):(\d{2})/g
    ];

    for (const pattern of timePatterns) {
      const matches = textContent.match(pattern);
      if (matches) {
        const timeMatch = matches[0];
        
        // Parse start and end times
        if (timeMatch.includes('-')) {
          const [startTimeStr, endTimeStr] = timeMatch.split('-').map(t => t.trim());
          timeInfo.startTime = this.convertTo24Hour(startTimeStr);
          timeInfo.endTime = this.convertTo24Hour(endTimeStr);
        } else {
          timeInfo.startTime = this.convertTo24Hour(timeMatch);
        }
        break;
      }
    }

    return timeInfo;
  }

  convertTo24Hour(timeString) {
    if (!timeString) return null;
    
    try {
      const time = timeString.toLowerCase().trim();
      
      // Already in 24-hour format
      if (/^\d{1,2}:\d{2}$/.test(time) && !time.includes('am') && !time.includes('pm')) {
        const [hours, minutes] = time.split(':');
        return `${hours.padStart(2, '0')}:${minutes}`;
      }
      
      // 12-hour format conversion
      let hours = 0;
      let minutes = 0;
      
      const timeMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = parseInt(timeMatch[2] || 0);
        const period = timeMatch[3];
        
        if (period === 'pm' && hours !== 12) {
          hours += 12;
        } else if (period === 'am' && hours === 12) {
          hours = 0;
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    } catch (e) {
      // Return null for invalid time strings
    }
    
    return null;
  }

  processSchweitzerLocation(locationText) {
    const result = {
      venue: null,
      locationNote: null
    };

    if (!locationText) return result;

    const cleanLocation = locationText.toLowerCase().trim();
    
    // Check for known Schweitzer venues
    for (const [key, venueName] of Object.entries(this.knownVenues)) {
      if (cleanLocation.includes(key)) {
        result.venue = venueName;
        return result;
      }
    }

    // Check for ambiguous locations
    const ambiguousTerms = [
      'various locations', 'multiple venues', 'throughout resort',
      'mountain-wide', 'resort-wide', 'tbd', 'to be determined'
    ];

    const isAmbiguous = ambiguousTerms.some(term => cleanLocation.includes(term));
    
    if (isAmbiguous) {
      result.locationNote = locationText;
    } else if (cleanLocation.includes('schweitzer')) {
      result.venue = 'Schweitzer Mountain Resort';
      if (locationText !== 'Schweitzer Mountain Resort') {
        result.locationNote = locationText;
      }
    } else {
      // Specific location that's not in our known venues
      result.venue = locationText;
    }

    return result;
  }

  extractSchweitzerFromJsonLd(jsonLdData) {
    const events = [];

    for (const data of jsonLdData) {
      try {
        if (data['@type'] === 'Event' || (data['@graph'] && Array.isArray(data['@graph']))) {
          const eventItems = data['@graph'] ? 
            data['@graph'].filter(item => item['@type'] === 'Event') : 
            [data];
          
          for (const eventItem of eventItems) {
            const eventData = {
              title: eventItem.name,
              description: eventItem.description,
              startDate: eventItem.startDate,
              endDate: eventItem.endDate,
              date: eventItem.startDate,
              url: eventItem.url,
              referenceUrl: eventItem.url,
              image: eventItem.image?.url || eventItem.image,
              performer: eventItem.performer,
              organizer: eventItem.organizer || 'Schweitzer Mountain Resort'
            };

            // Location handling for Schweitzer
            if (eventItem.location) {
              const locationName = eventItem.location.name || 
                                 eventItem.location.address?.addressLocality ||
                                 'Schweitzer Mountain Resort';
              
              const venueInfo = this.processSchweitzerLocation(locationName);
              eventData.venue = venueInfo.venue;
              eventData.locationNote = venueInfo.locationNote;
            }

            // Extract time information
            const timeInfo = this.extractTimeFromDates(eventData.startDate, eventData.endDate);
            eventData.startTime = timeInfo.startTime;
            eventData.endTime = timeInfo.endTime;

            // Ticket information
            if (eventItem.offers) {
              if (Array.isArray(eventItem.offers)) {
                eventData.ticketUrl = eventItem.offers[0]?.url;
                eventData.price = eventItem.offers[0]?.price;
              } else {
                eventData.ticketUrl = eventItem.offers.url;
                eventData.price = eventItem.offers.price;
              }
            }

            // Determine if needs review
            eventData.needsReview = this.shouldSchweitzerMarkForReview(eventData);

            if (eventData.title && eventData.startDate) {
              const normalizedEvent = this.normalizeEvent(eventData, this.source);
              events.push(normalizedEvent);
            }
          }
        }
      } catch (error) {
        console.warn(`Skipping invalid Schweitzer JSON-LD event: ${error.message}`);
      }
    }

    return events;
  }

  /**
   * Schweitzer-specific review criteria
   */
  shouldSchweitzerMarkForReview(eventData) {
    const reasons = [];

    // Missing time information - critical for Schweitzer events
    if (!eventData.startTime && !eventData.endTime) {
      reasons.push('missing_time');
    }

    // Missing image - Schweitzer should have promotional images
    if (!eventData.image) {
      reasons.push('missing_image');
    }

    // Ambiguous venue (has locationNote but no specific venue)
    if (eventData.locationNote && !eventData.venue) {
      reasons.push('ambiguous_venue');
    }

    // No location information at all
    if (!eventData.venue && !eventData.locationNote) {
      reasons.push('missing_location');
    }

    // For outdoor activities, check weather dependency
    if (eventData.title && eventData.description) {
      const text = `${eventData.title} ${eventData.description}`.toLowerCase();
      const outdoorKeywords = ['outdoor', 'mountain', 'hiking', 'skiing', 'biking', 'weather'];
      const isOutdoorEvent = outdoorKeywords.some(keyword => text.includes(keyword));
      
      if (isOutdoorEvent && !text.includes('weather') && !text.includes('conditions')) {
        reasons.push('outdoor_event_no_weather_info');
      }
    }

    // For concerts/performances, check performer info
    if (eventData.title && eventData.description) {
      const text = `${eventData.title} ${eventData.description}`.toLowerCase();
      const musicKeywords = ['concert', 'music', 'band', 'performance', 'live', 'show'];
      const isMusicEvent = musicKeywords.some(keyword => text.includes(keyword));
      
      if (isMusicEvent && !eventData.performer) {
        reasons.push('missing_performer_info');
      }
    }

    // Incomplete description
    if (!eventData.description || eventData.description.trim().length < 20) {
      reasons.push('incomplete_description');
    }

    // No reference URL
    if (!eventData.referenceUrl && !eventData.url) {
      reasons.push('missing_reference_url');
    }

    // For seasonal events, check date relevance
    if (eventData.title) {
      const title = eventData.title.toLowerCase();
      const seasonalKeywords = ['summer', 'winter', 'fall', 'spring', 'seasonal'];
      const isSeasonalEvent = seasonalKeywords.some(keyword => title.includes(keyword));
      
      if (isSeasonalEvent && eventData.startDate) {
        // Add season-specific validation if needed
        // This would require more complex date validation
      }
    }

    return reasons.length > 0;
  }

  removeDuplicates(events) {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.title.toLowerCase()}-${event.startDate || event.date}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract time information from date strings (inherited from base class)
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
}

module.exports = SchweitzerScraper;

// CLI execution
if (require.main === module) {
  const scraper = new SchweitzerScraper();
  
  console.log('🏔️ Starting Schweitzer Mountain Resort scraper...');
  console.log('📍 Source:', scraper.source);
  console.log('🌐 Events URL:', scraper.eventsUrl);
  console.log('🌐 Activities URL:', scraper.activitiesUrl);
  console.log('');
  
  scraper.scrapeEvents()
    .then(events => {
      console.log(`\n✅ Schweitzer scraping completed!`);
      console.log(`📊 Events found: ${events.length}`);
      console.log(`📁 Events saved to session directory`);
      
      if (events.length > 0) {
        console.log('\n📋 Sample events:');
        events.slice(0, 3).forEach((event, i) => {
          console.log(`${i + 1}. ${event.title}`);
          console.log(`   Date: ${event.startDate || event.date}`);
          console.log(`   Venue: ${event.venue?.name || event.venue || 'TBD'}`);
          console.log(`   Needs Review: ${event.needsReview ? 'Yes' : 'No'}`);
          console.log('');
        });
      }
    })
    .catch(error => {
      console.error('❌ Schweitzer scraping failed:', error.message);
      process.exit(1);
    });
}