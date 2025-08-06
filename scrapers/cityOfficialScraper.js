const EventScraper = require('../utils/eventScraper');

class CityOfficialScraper extends EventScraper {
  constructor() {
    super();
    this.source = 'City of Sandpoint';
    
    // Official city sources
    this.sources = [
      {
        name: 'City of Sandpoint',
        url: 'https://www.cityofsandpoint.com',
        paths: ['/calendar', '/events', '/community-events', '/news-events']
      },
      {
        name: 'Sandpoint Parks & Recreation',
        url: 'https://www.cityofsandpoint.com',
        paths: ['/parks-recreation', '/recreation']
      },
      {
        name: 'Greater Sandpoint Chamber',
        url: 'https://www.sandpointchamber.com',
        paths: ['/events', '/calendar', '/community-calendar']
      },
      {
        name: 'Visit Sandpoint',
        url: 'https://www.visitsandpoint.com',
        paths: ['/events', '/calendar', '/whats-happening']
      }
    ];
  }

  async scrapeOfficialEvents() {
    console.log(`Scraping events from official Sandpoint sources...`);
    
    const allEvents = [];
    const results = [];

    for (const source of this.sources) {
      try {
        console.log(`Scraping ${source.name}...`);
        const sourceEvents = await this.scrapeOfficialSource(source);
        allEvents.push(...sourceEvents);
        results.push({
          source: source.name,
          events: sourceEvents.length,
          status: 'success'
        });
      } catch (error) {
        console.error(`Error scraping ${source.name}:`, error.message);
        results.push({
          source: source.name,
          events: 0,
          status: 'error',
          error: error.message
        });
      }
    }

    // Remove duplicates
    const uniqueEvents = this.removeDuplicates(allEvents);
    
    console.log(`Successfully scraped ${uniqueEvents.length} events from official sources`);
    console.table(results);
    
    // Save events to file
    const filename = `city-official-${new Date().toISOString().split('T')[0]}.json`;
    await this.saveEvents(uniqueEvents, filename);
    
    return uniqueEvents;
  }

  async scrapeOfficialSource(source) {
    const events = [];

    for (const path of source.paths) {
      try {
        const url = `${source.url}${path}`;
        console.log(`  Checking ${url}...`);
        
        const { $ } = await this.scrapeWithCheerio(url);
        const pageEvents = await this.extractOfficialEvents($, source, url);
        events.push(...pageEvents);
        
        if (pageEvents.length > 0) {
          console.log(`  Found ${pageEvents.length} events at ${path}`);
        }
      } catch (error) {
        console.warn(`  Could not access ${source.url}${path}: ${error.message}`);
      }
    }

    return events;
  }

  async extractOfficialEvents($, source, url) {
    const events = [];

    // Try structured data first (JSON-LD)
    const jsonLdData = this.extractJsonLd($);
    const structuredEvents = this.extractStructuredEvents(jsonLdData, source);
    events.push(...structuredEvents);

    // Try common calendar/event selectors
    const eventSelectors = [
      '.event-item',
      '.calendar-event',
      '.event',
      '.event-listing',
      '.upcoming-event',
      '.event-card',
      '.vevent', // Microformat
      '[itemtype*="Event"]' // Microdata
    ];

    for (const selector of eventSelectors) {
      const eventElements = $(selector);
      if (eventElements.length > 0) {
        console.log(`    Found ${eventElements.length} events with selector: ${selector}`);
        
        eventElements.each((index, element) => {
          try {
            const eventData = this.extractOfficialEventData($, $(element), url);
            if (eventData.title && eventData.date) {
              const normalizedEvent = this.normalizeEvent(eventData, `${this.source} - ${source.name}`);
              events.push(normalizedEvent);
            }
          } catch (error) {
            console.warn(`    Skipping event: ${error.message}`);
          }
        });
        break; // Use first working selector
      }
    }

    // Fallback: Look for WordPress events
    if (events.length === 0) {
      const wpEvents = this.extractWordPressEvents($, source, url);
      events.push(...wpEvents);
    }

    // Fallback: Generic event extraction
    if (events.length === 0) {
      const genericEvents = this.extractGenericOfficialEvents($, source, url);
      events.push(...genericEvents.slice(0, 5)); // Limit generic events
    }

    return events;
  }

  extractOfficialEventData($, $element, baseUrl) {
    const eventData = {};

    // Title extraction patterns
    const titleSelectors = [
      '.event-title',
      '.title',
      'h1', 'h2', 'h3', 'h4',
      '.entry-title',
      '.post-title',
      '.summary', // Microformat
      '[itemprop="name"]' // Microdata
    ];

    for (const selector of titleSelectors) {
      const titleEl = $element.find(selector).first();
      if (titleEl.length && titleEl.text().trim()) {
        eventData.title = titleEl.text().trim();
        
        // Get URL if title is a link
        if (titleEl.is('a')) {
          eventData.url = this.resolveUrl(titleEl.attr('href'), baseUrl);
        } else {
          const linkEl = titleEl.find('a').first();
          if (linkEl.length) {
            eventData.url = this.resolveUrl(linkEl.attr('href'), baseUrl);
          }
        }
        break;
      }
    }

    // Date extraction patterns
    const dateSelectors = [
      '.event-date',
      '.date',
      '.dtstart', // Microformat
      'time',
      '.event-time',
      '[datetime]',
      '[itemprop="startDate"]' // Microdata
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

    // Description
    const descSelectors = [
      '.event-description',
      '.description',
      '.event-summary',
      '.content',
      '.entry-content',
      'p',
      '[itemprop="description"]'
    ];

    for (const selector of descSelectors) {
      const descEl = $element.find(selector).first();
      if (descEl.length && descEl.text().trim() && descEl.text().trim() !== eventData.title) {
        eventData.description = descEl.text().trim().substring(0, 500);
        break;
      }
    }

    // Location/Venue
    const locationSelectors = [
      '.event-location',
      '.location',
      '.venue',
      '.event-venue',
      '[itemprop="location"]'
    ];

    for (const selector of locationSelectors) {
      const locationEl = $element.find(selector).first();
      if (locationEl.length && locationEl.text().trim()) {
        eventData.venue = locationEl.text().trim();
        break;
      }
    }

    // Image
    const imgEl = $element.find('img').first();
    if (imgEl.length) {
      const imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
      if (imgSrc) {
        eventData.image = this.resolveUrl(imgSrc, baseUrl);
      }
    }

    // Tags from categories or classes
    const categoryEl = $element.find('.category, .event-category, .post-category');
    if (categoryEl.length) {
      const tags = [];
      categoryEl.each((i, el) => {
        const tag = $(el).text().trim();
        if (tag) tags.push(tag);
      });
      if (tags.length > 0) {
        eventData.tags = tags;
      }
    }

    return eventData;
  }

  extractStructuredEvents(jsonLdData, source) {
    const events = [];

    for (const data of jsonLdData) {
      try {
        if (data['@type'] === 'Event') {
          const eventData = {
            title: data.name,
            description: data.description,
            date: data.startDate,
            endDate: data.endDate,
            url: data.url,
            venue: data.location?.name || data.location?.address?.addressLocality,
            image: data.image?.url || data.image
          };

          if (eventData.title && eventData.date) {
            const normalizedEvent = this.normalizeEvent(eventData, `${this.source} - ${source.name}`);
            events.push(normalizedEvent);
          }
        }
      } catch (error) {
        console.warn(`Skipping invalid structured event: ${error.message}`);
      }
    }

    return events;
  }

  extractWordPressEvents($, source, baseUrl) {
    const events = [];
    
    // WordPress event patterns
    $('.post, .entry, .event-post').each((index, element) => {
      try {
        const $el = $(element);
        const title = $el.find('.entry-title, .post-title, h2, h3').first().text().trim();
        const content = $el.find('.entry-content, .post-content').text();
        
        if (title && content) {
          // Check if content suggests it's an event
          const hasEventKeywords = /\b(event|meeting|workshop|festival|concert|show|celebration|class|seminar)\b/i.test(content.toLowerCase());
          const hasDatePattern = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}\/\d{4})\b/i.test(content);
          
          if (hasEventKeywords && hasDatePattern) {
            const eventData = {
              title: title,
              description: content.substring(0, 300),
              date: this.extractDateFromText(content),
              url: this.resolveUrl($el.find('a').first().attr('href'), baseUrl)
            };
            
            if (eventData.date) {
              const normalizedEvent = this.normalizeEvent(eventData, `${this.source} - ${source.name}`);
              events.push(normalizedEvent);
            }
          }
        }
      } catch (error) {
        // Skip invalid entries
      }
    });

    return events;
  }

  extractGenericOfficialEvents($, source, baseUrl) {
    const events = [];
    
    // Look for any content that might be events
    $('*:contains("event"):not(script):not(style), *:contains("meeting"):not(script):not(style)').each((index, element) => {
      if (events.length >= 10) return false; // Limit to prevent noise
      
      const $el = $(element);
      const text = $el.text();
      
      // Skip if too long or short
      if (text.length < 30 || text.length > 500) return;
      
      // Must have event keywords and date
      const hasEventKeywords = /\b(event|meeting|workshop|festival|concert|show|celebration|class|seminar|council meeting|public hearing)\b/i.test(text);
      const dateMatch = text.match(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i);
      
      if (hasEventKeywords && dateMatch) {
        try {
          const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          const eventData = {
            title: lines[0] || 'City Event',
            description: text.substring(0, 250),
            date: dateMatch[0]
          };
          
          const normalizedEvent = this.normalizeEvent(eventData, `${this.source} - ${source.name}`);
          events.push(normalizedEvent);
        } catch (error) {
          // Skip invalid events
        }
      }
    });

    return events;
  }

  resolveUrl(url, baseUrl) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return null;
    }
  }

  extractDateFromText(text) {
    const patterns = [
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      /\b\d{4}-\d{2}-\d{2}\b/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }

    return null;
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
}

module.exports = CityOfficialScraper;