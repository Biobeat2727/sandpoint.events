const EventScraper = require('../utils/eventScraper');

class EventbriteScraper extends EventScraper {
  constructor() {
    super();
    this.baseUrl = 'https://www.eventbrite.com';
    this.searchUrl = 'https://www.eventbrite.com/d/id--sandpoint/events/';
    this.source = 'Eventbrite';
  }

  async scrapeEvents(location = 'Sandpoint, ID', radius = 25) {
    console.log(`Scraping events from ${this.source} for ${location}...`);
    
    try {
      // Use Puppeteer for dynamic content
      const { $ } = await this.scrapeWithPuppeteer(this.searchUrl, {
        waitForSelector: '[data-spec="search-result-item"]',
        timeout: 30000
      });

      const events = [];
      const eventCards = $('[data-spec="search-result-item"], .search-results-list-item, .event-card');

      console.log(`Found ${eventCards.length} potential events`);

      eventCards.each((index, element) => {
        try {
          const eventData = this.extractEventbriteEventData($, $(element));
          if (eventData.title && eventData.date) {
            // Filter for Sandpoint area events
            if (this.isInSandpointArea(eventData)) {
              const normalizedEvent = this.normalizeEvent(eventData, this.source);
              events.push(normalizedEvent);
            }
          }
        } catch (error) {
          console.warn(`Skipping invalid Eventbrite event: ${error.message}`);
        }
      });

      // Also try to extract from JSON-LD
      const jsonLdData = this.extractJsonLd($);
      const structuredEvents = this.extractEventbriteFromJsonLd(jsonLdData);
      events.push(...structuredEvents);

      const filteredEvents = this.removeDuplicates(events);
      console.log(`Successfully scraped ${filteredEvents.length} events from ${this.source}`);
      
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
          eventData.url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        }
        break;
      }
    }

    // Date and time
    const dateSelectors = [
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

    // Image
    const imgEl = $element.find('img').first();
    if (imgEl.length) {
      const imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
      if (imgSrc) {
        eventData.image = imgSrc.startsWith('http') ? imgSrc : `${this.baseUrl}${imgSrc}`;
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
              date: eventItem.startDate,
              endDate: eventItem.endDate,
              url: eventItem.url,
              venue: eventItem.location?.name || eventItem.location?.address?.addressLocality,
              location: eventItem.location?.address ? 
                `${eventItem.location.address.addressLocality}, ${eventItem.location.address.addressRegion}` : 
                eventItem.location?.name,
              image: eventItem.image?.url || eventItem.image,
              price: eventItem.offers?.price || eventItem.offers?.lowPrice
            };

            if (eventData.title && eventData.date && this.isInSandpointArea(eventData)) {
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
        return this.normalizeEvent({
          title: event.name?.text,
          description: event.description?.text,
          date: event.start?.utc,
          endDate: event.end?.utc,
          url: event.url,
          venue: event.venue?.name,
          location: `${event.venue?.address?.city || ''}, ${event.venue?.address?.region || ''}`.trim().replace(/^,\s*/, ''),
          image: event.logo?.url,
          price: event.ticket_classes?.[0]?.cost ? `$${event.ticket_classes[0].cost.display}` : null,
          tags: event.category ? [event.category.name] : []
        }, this.source);
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