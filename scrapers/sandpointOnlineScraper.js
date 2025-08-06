const EventScraper = require('../utils/eventScraper');

class SandpointOnlineScraper extends EventScraper {
  constructor() {
    super();
    this.baseUrl = 'https://sandpointonline.com';
    this.eventsUrl = 'https://sandpointonline.com/calendar';
    this.source = 'Sandpoint Online';
  }

  async scrapeEvents() {
    console.log(`Scraping events from ${this.source}...`);
    
    try {
      const { $ } = await this.scrapeWithCheerio(this.eventsUrl);
      
      // Extract events using common calendar patterns
      const events = [];
      const eventSelectors = [
        '.event-item',
        '.calendar-event',
        '.event-listing',
        '[class*="event"]',
        '.vevent'
      ];

      for (const selector of eventSelectors) {
        const eventElements = $(selector);
        if (eventElements.length > 0) {
          console.log(`Found ${eventElements.length} events with selector: ${selector}`);
          
          eventElements.each((index, element) => {
            try {
              const eventData = this.extractEventData($, $(element));
              if (eventData.title && eventData.date) {
                const normalizedEvent = this.normalizeEvent(eventData, this.source);
                events.push(normalizedEvent);
              }
            } catch (error) {
              console.warn(`Skipping invalid event: ${error.message}`);
            }
          });
          break; // Use the first matching selector
        }
      }

      // Fallback: try to extract from structured data
      if (events.length === 0) {
        const jsonLdData = this.extractJsonLd($);
        const structuredEvents = this.extractFromJsonLd(jsonLdData);
        events.push(...structuredEvents);
      }

      // Fallback: generic extraction patterns
      if (events.length === 0) {
        const genericEvents = this.extractGenericEvents($);
        events.push(...genericEvents);
      }

      console.log(`Successfully scraped ${events.length} events from ${this.source}`);
      
      // Save events to file
      const filename = `sandpoint-online-${new Date().toISOString().split('T')[0]}.json`;
      await this.saveEvents(events, filename);
      
      return events;
    } catch (error) {
      console.error(`Error scraping ${this.source}:`, error);
      return [];
    }
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

    // Extract URL
    const linkEl = $element.find('a[href]').first();
    if (linkEl.length) {
      let url = linkEl.attr('href');
      if (url && !url.startsWith('http')) {
        url = new URL(url, this.baseUrl).toString();
      }
      eventData.url = url;
    }

    // Extract venue
    for (const selector of patterns.venue) {
      const venueEl = $element.find(selector).first();
      if (venueEl.length && venueEl.text().trim()) {
        eventData.venue = venueEl.text().trim();
        break;
      }
    }

    // Extract image
    const imgEl = $element.find('img').first();
    if (imgEl.length) {
      let imgSrc = imgEl.attr('src') || imgEl.attr('data-src');
      if (imgSrc && !imgSrc.startsWith('http')) {
        imgSrc = new URL(imgSrc, this.baseUrl).toString();
      }
      eventData.image = imgSrc;
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
              venue: eventItem.location?.name || eventItem.location,
              image: eventItem.image?.url || eventItem.image
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
      /\b\d{4}-\d{2}-\d{2}\b/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
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