const EventScraper = require('../utils/eventScraper');

class LocalVenueScraper extends EventScraper {
  constructor() {
    super();
    this.source = 'Local Venues';
    
    // Define local Sandpoint venues and their websites
    this.venues = [
      {
        name: 'Panida Theater',
        url: 'https://www.panida.org',
        eventsPath: '/events',
        selectors: {
          eventList: '.event-item, .upcoming-events .event',
          title: '.event-title, h3, .title',
          date: '.event-date, .date, time',
          description: '.event-description, .description'
        }
      },
      {
        name: 'The Hive',
        url: 'https://www.hivesandpoint.com',
        eventsPath: '/events',
        selectors: {
          eventList: '.event, .show',
          title: '.event-title, .show-title, h3',
          date: '.date, .event-date, time',
          description: '.description, .details'
        }
      },
      {
        name: 'MickDuff\'s Beer Hall',
        url: 'https://www.mickduffs.com',
        eventsPath: '/events',
        selectors: {
          eventList: '.event-item, .event',
          title: '.event-title, h3',
          date: '.event-date, .date',
          description: '.event-description'
        }
      },
      {
        name: 'Eichardt\'s Pub',
        url: 'https://www.eichardtspub.com',
        eventsPath: '/events',
        selectors: {
          eventList: '.event, .show-listing',
          title: '.title, h3',
          date: '.date, .when',
          description: '.description, .details'
        }
      },
      {
        name: 'Festival at Sandpoint',
        url: 'https://www.festivalatsandpoint.com',
        eventsPath: '/concerts',
        selectors: {
          eventList: '.concert-item, .event-item',
          title: '.concert-title, .event-title',
          date: '.concert-date, .event-date',
          description: '.concert-description, .description'
        }
      },
      {
        name: 'Bonner County Fairgrounds',
        url: 'https://www.bonnercountyfair.com',
        eventsPath: '/events',
        selectors: {
          eventList: '.event-listing, .event',
          title: '.event-title, h3',
          date: '.event-date, .date',
          description: '.event-description'
        }
      },
      {
        name: 'Sandpoint City Beach',
        url: 'https://www.cityofsandpoint.com',
        eventsPath: '/events',
        selectors: {
          eventList: '.event-item',
          title: '.event-title',
          date: '.event-date',
          description: '.event-description'
        }
      }
    ];
  }

  async scrapeAllVenues() {
    console.log(`Scraping events from ${this.venues.length} local venues...`);
    
    const allEvents = [];
    const results = [];

    for (const venue of this.venues) {
      try {
        console.log(`Scraping ${venue.name}...`);
        const venueEvents = await this.scrapeVenue(venue);
        allEvents.push(...venueEvents);
        results.push({
          venue: venue.name,
          events: venueEvents.length,
          status: 'success'
        });
      } catch (error) {
        console.error(`Error scraping ${venue.name}:`, error.message);
        results.push({
          venue: venue.name,
          events: 0,
          status: 'error',
          error: error.message
        });
      }
    }

    // Remove duplicates
    const uniqueEvents = this.removeDuplicates(allEvents);
    
    console.log(`Successfully scraped ${uniqueEvents.length} events from local venues`);
    console.table(results);
    
    // Save events to file
    const filename = `local-venues-${new Date().toISOString().split('T')[0]}.json`;
    await this.saveEvents(uniqueEvents, filename);
    
    return uniqueEvents;
  }

  async scrapeVenue(venue) {
    const events = [];
    
    try {
      // Try primary events page
      const eventsUrl = `${venue.url}${venue.eventsPath}`;
      const { $ } = await this.scrapeWithCheerio(eventsUrl);
      
      const eventElements = $(venue.selectors.eventList);
      
      if (eventElements.length > 0) {
        eventElements.each((index, element) => {
          try {
            const eventData = this.extractVenueEventData($, $(element), venue);
            if (eventData.title && eventData.date) {
              const normalizedEvent = this.normalizeEvent(eventData, `${this.source} - ${venue.name}`);
              normalizedEvent.venue = venue.name;
              events.push(normalizedEvent);
            }
          } catch (error) {
            console.warn(`Skipping event from ${venue.name}: ${error.message}`);
          }
        });
      } else {
        // Fallback: try generic extraction
        console.log(`No events found with selectors for ${venue.name}, trying generic extraction...`);
        const genericEvents = await this.scrapeVenueGeneric(venue);
        events.push(...genericEvents);
      }
      
    } catch (error) {
      console.warn(`Could not scrape ${venue.name}: ${error.message}`);
    }

    return events;
  }

  extractVenueEventData($, $element, venue) {
    const eventData = {
      venue: venue.name
    };

    // Title and URL extraction
    const titleEl = $element.find(venue.selectors.title).first();
    if (titleEl.length) {
      eventData.title = titleEl.text().trim();
      
      // Check if title element is a link
      const linkEl = titleEl.is('a') ? titleEl : titleEl.find('a').first();
      if (linkEl.length) {
        let href = linkEl.attr('href');
        if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          href = new URL(href, venue.url).toString();
        }
        if (href && href.startsWith('http')) {
          eventData.url = href;
        }
      }
    }
    
    // Look for additional event detail links
    if (!eventData.url) {
      const linkSelectors = [
        'a[href*="event"]',
        'a[href*="show"]',
        'a[href*="details"]',
        '.event-link a',
        '.more-info a',
        'a'
      ];
      
      for (const selector of linkSelectors) {
        const linkEl = $element.find(selector).first();
        if (linkEl.length) {
          let href = linkEl.attr('href');
          if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            href = new URL(href, venue.url).toString();
          }
          if (href && href.startsWith('http')) {
            eventData.url = href;
            break;
          }
        }
      }
    }
    
    // Look specifically for ticket/registration links
    const ticketSelectors = [
      'a[href*="ticket"]',
      'a[href*="buy"]',
      'a[href*="register"]',
      'a[href*="eventbrite"]',
      'a[href*="purchase"]',
      'a:contains("Tickets")',
      'a:contains("Buy Tickets")',
      'a:contains("Register")',
      'a:contains("Purchase")',
      '.ticket-link a',
      '.buy-tickets a',
      '.registration a'
    ];
    
    for (const selector of ticketSelectors) {
      const ticketEl = $element.find(selector).first();
      if (ticketEl.length) {
        let ticketUrl = ticketEl.attr('href');
        if (ticketUrl && !ticketUrl.startsWith('http') && !ticketUrl.startsWith('mailto:')) {
          ticketUrl = new URL(ticketUrl, venue.url).toString();
        }
        if (ticketUrl && ticketUrl.startsWith('http')) {
          eventData.ticketUrl = ticketUrl;
          break;
        }
      }
    }

    // Date
    const dateEl = $element.find(venue.selectors.date).first();
    if (dateEl.length) {
      eventData.date = dateEl.attr('datetime') || 
                       dateEl.attr('content') ||
                       dateEl.text().trim();
    }

    // Description
    const descEl = $element.find(venue.selectors.description).first();
    if (descEl.length) {
      eventData.description = descEl.text().trim();
    }

    // Image - prioritize high-quality event images
    const imageSelectors = [
      '.event-image img',
      '.event-photo img',
      '.poster img',
      '.featured-image img',
      'img[alt*="event"]',
      'img[alt*="show"]',
      'img[alt*="concert"]',
      'img[src*="event"]',
      'img[src*="show"]',
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
          const alt = imgEl.attr('alt') || '';
          
          // Skip if dimensions are too small (likely icons or logos)
          if ((width && parseInt(width) < 80) || (height && parseInt(height) < 80)) {
            continue;
          }
          
          // Skip common logo/icon filenames and alt text
          const filename = imgSrc.toLowerCase();
          const altText = alt.toLowerCase();
          if (filename.includes('logo') || filename.includes('icon') || 
              filename.includes('avatar') || altText.includes('logo') ||
              altText.includes('icon') || filename.includes('thumb_')) {
            continue;
          }
          
          // Convert relative URLs to absolute
          if (!imgSrc.startsWith('http')) {
            if (imgSrc.startsWith('//')) {
              imgSrc = 'https:' + imgSrc;
            } else {
              imgSrc = new URL(imgSrc, venue.url).toString();
            }
          }
          
          eventData.image = imgSrc;
          break;
        }
      }
    }
    
    // Check for CSS background images if no img tag found
    if (!eventData.image) {
      const bgElements = $element.find('[style*="background-image"], .hero-image, .event-banner');
      bgElements.each((i, el) => {
        const style = $(el).attr('style') || '';
        const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/);
        if (bgMatch && bgMatch[1]) {
          let bgImg = bgMatch[1];
          if (!bgImg.startsWith('http')) {
            bgImg = new URL(bgImg, venue.url).toString();
          }
          eventData.image = bgImg;
          return false; // Break out of each loop
        }
      });
    }

    // Price
    const priceText = $element.text();
    const priceMatch = priceText.match(/\$\d+(?:\.\d{2})?/);
    if (priceMatch) {
      eventData.price = priceMatch[0];
    }

    return eventData;
  }

  async scrapeVenueGeneric(venue) {
    const events = [];
    
    try {
      // Try homepage
      const { $ } = await this.scrapeWithCheerio(venue.url);
      
      // Look for event-related content
      const eventKeywords = ['event', 'show', 'concert', 'performance', 'upcoming'];
      
      eventKeywords.forEach(keyword => {
        $(`*:contains("${keyword}"):not(script):not(style)`).each((index, element) => {
          if (events.length >= 5) return false; // Limit to prevent noise
          
          const $el = $(element);
          const text = $el.text();
          
          // Skip if too long or short
          if (text.length < 20 || text.length > 300) return;
          
          // Look for date patterns
          const dateMatch = text.match(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i);
          
          if (dateMatch) {
            try {
              const lines = text.split('\n').map(line => line.trim()).filter(line => line);
              const eventData = {
                title: lines[0] || `Event at ${venue.name}`,
                description: text.substring(0, 200),
                date: dateMatch[0],
                venue: venue.name
              };
              
              const normalizedEvent = this.normalizeEvent(eventData, `${this.source} - ${venue.name}`);
              events.push(normalizedEvent);
            } catch (error) {
              // Skip invalid events
            }
          }
        });
      });
      
    } catch (error) {
      console.warn(`Generic scraping failed for ${venue.name}: ${error.message}`);
    }

    return events.slice(0, 3); // Limit generic events per venue
  }

  removeDuplicates(events) {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.title.toLowerCase()}-${event.date}-${event.venue}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Method to add a new venue to scrape
  addVenue(venue) {
    this.venues.push(venue);
  }

  // Method to scrape a single venue by name
  async scrapeVenueByName(venueName) {
    const venue = this.venues.find(v => v.name.toLowerCase().includes(venueName.toLowerCase()));
    if (!venue) {
      throw new Error(`Venue not found: ${venueName}`);
    }
    
    return this.scrapeVenue(venue);
  }
}

module.exports = LocalVenueScraper;