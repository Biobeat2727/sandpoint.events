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

    // Title
    const titleEl = $element.find(venue.selectors.title).first();
    if (titleEl.length) {
      eventData.title = titleEl.text().trim();
      
      // Check if title element is a link
      const linkEl = titleEl.is('a') ? titleEl : titleEl.find('a').first();
      if (linkEl.length) {
        let href = linkEl.attr('href');
        if (href && !href.startsWith('http')) {
          href = new URL(href, venue.url).toString();
        }
        eventData.url = href;
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

    // Image
    const imgEl = $element.find('img').first();
    if (imgEl.length) {
      let imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
      if (imgSrc && !imgSrc.startsWith('http')) {
        imgSrc = new URL(imgSrc, venue.url).toString();
      }
      eventData.image = imgSrc;
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