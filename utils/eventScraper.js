const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { format, parse, addDays, isValid } = require('date-fns');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

class EventScraper {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.dataDir = path.join(this.baseDir, 'data', 'scraped-events');
    this.browser = null;
    this.defaultTags = ['Community', 'Event'];
    
    // Ensure data directory exists
    fs.ensureDirSync(this.dataDir);
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Generic HTTP scraping with Cheerio
  async scrapeWithCheerio(url, options = {}) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          ...options.headers
        },
        timeout: options.timeout || 10000
      });

      const $ = cheerio.load(response.data);
      return { $, html: response.data };
    } catch (error) {
      console.error(`Error scraping ${url} with Cheerio:`, error.message);
      throw error;
    }
  }

  // Browser-based scraping with Puppeteer for dynamic content
  async scrapeWithPuppeteer(url, options = {}) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || 30000
      });

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      }

      const content = await page.content();
      const $ = cheerio.load(content);
      
      return { $, page, html: content };
    } catch (error) {
      console.error(`Error scraping ${url} with Puppeteer:`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  // Standardize event data format
  normalizeEvent(rawEvent, source) {
    const event = {
      id: rawEvent.id || uuidv4(),
      title: this.cleanText(rawEvent.title),
      slug: this.generateSlug(rawEvent.title),
      description: this.cleanText(rawEvent.description) || '',
      date: this.parseEventDate(rawEvent.date),
      endDate: rawEvent.endDate ? this.parseEventDate(rawEvent.endDate) : null,
      image: rawEvent.image || null,
      url: rawEvent.url || null,
      tickets: rawEvent.tickets || null,
      venue: this.normalizeVenue(rawEvent.venue),
      tags: this.normalizeTags(rawEvent.tags),
      source: source,
      location: rawEvent.location || 'Sandpoint, ID',
      price: rawEvent.price || null,
      contact: rawEvent.contact || null,
      scraped_at: new Date().toISOString()
    };

    // Validate required fields
    if (!event.title || !event.date) {
      throw new Error(`Invalid event data: missing title or date`);
    }

    return event;
  }

  cleanText(text) {
    if (!text) return '';
    return text.toString()
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
  }

  generateSlug(title) {
    if (!title) return uuidv4();
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-')
      .substring(0, 50) || uuidv4();
  }

  parseEventDate(dateString) {
    if (!dateString) return null;
    
    // Try various date formats
    const formats = [
      'yyyy-MM-dd HH:mm:ss',
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'MMMM d, yyyy',
      'MMM d, yyyy',
      'dd/MM/yyyy',
      'yyyy-MM-dd\'T\'HH:mm:ss.SSSz',
      'yyyy-MM-dd\'T\'HH:mm:ssz'
    ];

    for (const format of formats) {
      try {
        const parsed = parse(dateString.toString(), format, new Date());
        if (isValid(parsed)) {
          return parsed.toISOString();
        }
      } catch (e) {
        continue;
      }
    }

    // Try native Date parsing as last resort
    const nativeDate = new Date(dateString);
    if (isValid(nativeDate)) {
      return nativeDate.toISOString();
    }

    return null;
  }

  normalizeVenue(venue) {
    if (!venue) return null;
    
    if (typeof venue === 'string') {
      return { name: this.cleanText(venue) };
    }
    
    return {
      name: this.cleanText(venue.name) || '',
      address: this.cleanText(venue.address) || '',
      city: venue.city || 'Sandpoint',
      state: venue.state || 'ID',
      zipCode: venue.zipCode || '',
      phone: venue.phone || '',
      website: venue.website || ''
    };
  }

  normalizeTags(tags) {
    if (!tags || !Array.isArray(tags)) {
      return this.defaultTags;
    }

    const normalizedTags = tags
      .map(tag => this.cleanText(tag))
      .filter(tag => tag.length > 0)
      .map(tag => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase());

    return [...new Set([...normalizedTags, ...this.defaultTags])];
  }

  // Save events to JSON file
  async saveEvents(events, filename) {
    const filepath = path.join(this.dataDir, filename);
    await fs.writeJson(filepath, events, { spaces: 2 });
    console.log(`Saved ${events.length} events to ${filepath}`);
    return filepath;
  }

  // Load events from JSON file
  async loadEvents(filename) {
    const filepath = path.join(this.dataDir, filename);
    
    if (await fs.pathExists(filepath)) {
      return await fs.readJson(filepath);
    }
    
    return [];
  }

  // Extract common patterns from HTML
  extractPatterns($, selectors) {
    const patterns = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        if (typeof selector === 'string') {
          patterns[key] = $(selector).text().trim();
        } else if (selector.attr) {
          patterns[key] = $(selector.selector).attr(selector.attr);
        } else if (selector.multiple) {
          patterns[key] = [];
          $(selector.selector).each((i, el) => {
            const value = selector.attr ? $(el).attr(selector.attr) : $(el).text().trim();
            if (value) patterns[key].push(value);
          });
        }
      } catch (e) {
        patterns[key] = null;
      }
    }
    
    return patterns;
  }

  // Helper for extracting structured data (JSON-LD)
  extractJsonLd($) {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const structuredData = [];

    jsonLdScripts.each((i, script) => {
      try {
        const data = JSON.parse($(script).html());
        structuredData.push(data);
      } catch (e) {
        // Skip invalid JSON-LD
      }
    });

    return structuredData;
  }

  // Filter events by date range and location
  filterEvents(events, filters = {}) {
    return events.filter(event => {
      // Date filtering
      if (filters.startDate) {
        const eventDate = new Date(event.date);
        const startDate = new Date(filters.startDate);
        if (eventDate < startDate) return false;
      }

      if (filters.endDate) {
        const eventDate = new Date(event.date);
        const endDate = new Date(filters.endDate);
        if (eventDate > endDate) return false;
      }

      // Location filtering
      if (filters.location) {
        const location = event.location?.toLowerCase() || '';
        if (!location.includes(filters.location.toLowerCase())) return false;
      }

      // Tag filtering
      if (filters.tags && filters.tags.length > 0) {
        const eventTags = event.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = filters.tags.some(filterTag => 
          eventTags.includes(filterTag.toLowerCase())
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }
}

module.exports = EventScraper;