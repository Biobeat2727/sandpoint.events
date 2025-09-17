const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { format, parse, addDays, isValid } = require('date-fns');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class EventScraper {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.dataDir = path.join(this.baseDir, 'data', 'scraped-events');
    this.sessionsDir = path.join(this.dataDir, 'sessions');
    this.latestDir = path.join(this.dataDir, 'latest');
    this.archivesDir = path.join(this.dataDir, 'archives');
    this.currentSession = null;
    this.browser = null;
    this.defaultTags = ['Community', 'Event'];
    
    // Ensure all directories exist
    fs.ensureDirSync(this.dataDir);
    fs.ensureDirSync(this.sessionsDir);
    fs.ensureDirSync(this.latestDir);
    fs.ensureDirSync(this.archivesDir);
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list',
          '--ignore-certificate-errors-skip-list',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ]
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

      if (options.waitForSelector && !options.skipWaitForSelector) {
        try {
          await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
        } catch (error) {
          console.warn(`Warning: Could not find selector ${options.waitForSelector}, continuing anyway...`);
        }
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
      date: this.parseEventDate(rawEvent.date || rawEvent.startDate),
      startDate: rawEvent.startDate ? this.parseEventDate(rawEvent.startDate) : this.parseEventDate(rawEvent.date),
      endDate: rawEvent.endDate ? this.parseEventDate(rawEvent.endDate) : null,
      startTime: rawEvent.startTime || null,
      endTime: rawEvent.endTime || null,
      image: rawEvent.image || null,
      imageUrl: this.normalizeImageUrl(rawEvent.image || rawEvent.imageUrl),
      url: this.normalizeUrl(rawEvent.url),
      referenceUrl: this.normalizeUrl(rawEvent.referenceUrl || rawEvent.url),
      ticketUrl: this.normalizeUrl(rawEvent.ticketUrl || rawEvent.ticketsUrl || rawEvent.tickets),
      venue: this.normalizeVenue(rawEvent.venue),
      locationNote: rawEvent.locationNote || null,
      needsReview: rawEvent.needsReview || false,
      tags: this.normalizeTags(rawEvent.tags),
      source: source,
      location: rawEvent.location || 'Sandpoint, ID',
      price: rawEvent.price || null,
      contact: rawEvent.contact || null,
      performer: rawEvent.performer || null,
      organizer: rawEvent.organizer || null,
      scraped_at: new Date().toISOString()
    };

    // Validate required fields - use startDate if available, fall back to date
    const eventDate = event.startDate || event.date;
    if (!event.title || !eventDate) {
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

  normalizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    url = url.trim();
    if (!url) return null;
    
    // Skip if it's obviously not a URL
    if (url.includes('@') && !url.startsWith('http')) return null;
    if (url.startsWith('tel:') || url.startsWith('mailto:')) return null;
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      const urlObj = new URL(url);
      return urlObj.toString();
    } catch (e) {
      return null;
    }
  }

  normalizeImageUrl(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    
    imageUrl = imageUrl.trim();
    if (!imageUrl) return null;
    
    // Skip data URLs, placeholder images, and very small images
    if (imageUrl.startsWith('data:')) return null;
    if (imageUrl.includes('placeholder') || imageUrl.includes('default')) return null;
    if (imageUrl.includes('1x1') || imageUrl.includes('tiny')) return null;
    
    // Add protocol if missing
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        // This would need the base URL to be complete, handle in specific scrapers
        return imageUrl;
      } else {
        imageUrl = 'https://' + imageUrl;
      }
    }
    
    try {
      const urlObj = new URL(imageUrl);
      // Only accept common image formats
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const hasValidExtension = validExtensions.some(ext => 
        urlObj.pathname.toLowerCase().includes(ext)
      );
      
      // If no extension but looks like an image URL, still accept it
      if (!hasValidExtension && !urlObj.pathname.includes('image') && 
          !urlObj.pathname.includes('photo') && !urlObj.pathname.includes('img')) {
        return null;
      }
      
      return urlObj.toString();
    } catch (e) {
      return null;
    }
  }

  // Create a new session directory
  createSession() {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    const sessionDir = path.join(this.sessionsDir, timestamp);
    fs.ensureDirSync(sessionDir);
    
    this.currentSession = {
      timestamp,
      sessionDir,
      files: [],
      startTime: new Date().toISOString()
    };
    
    console.log(`Created new session: ${timestamp}`);
    return this.currentSession;
  }

  // Save events to JSON file with session-based structure
  async saveEvents(events, filename) {
    // Create session if it doesn't exist
    if (!this.currentSession) {
      this.createSession();
    }
    
    // Save to session directory
    const sessionFilepath = path.join(this.currentSession.sessionDir, filename);
    await fs.writeJson(sessionFilepath, events, { spaces: 2 });
    
    // Track file in session
    this.currentSession.files.push({
      filename,
      filepath: sessionFilepath,
      eventCount: events.length,
      savedAt: new Date().toISOString()
    });
    
    // Create/update symlink in latest directory
    await this.updateLatestSymlink(filename, sessionFilepath);
    
    // Also save to old flat structure for backward compatibility during transition
    const legacyFilepath = path.join(this.dataDir, filename);
    await fs.writeJson(legacyFilepath, events, { spaces: 2 });
    
    console.log(`Saved ${events.length} events to session: ${sessionFilepath}`);
    console.log(`Updated latest symlink and legacy file`);
    
    return sessionFilepath;
  }

  // Update symlink in latest directory
  async updateLatestSymlink(filename, sessionFilepath) {
    try {
      // Generate latest filename (e.g., sandpoint-online-page-1.json -> sandpoint-online-latest.json)
      const latestFilename = this.generateLatestFilename(filename);
      const latestFilepath = path.join(this.latestDir, latestFilename);
      
      // Remove existing symlink/file if it exists
      if (await fs.pathExists(latestFilepath)) {
        await fs.remove(latestFilepath);
      }
      
      // On Windows, symlinks require admin privileges, so we'll copy the file instead
      if (os.platform() === 'win32') {
        await fs.copy(sessionFilepath, latestFilepath);
        console.log(`Copied to latest: ${latestFilename}`);
      } else {
        // On Unix-like systems, create a symlink
        const relativePath = path.relative(this.latestDir, sessionFilepath);
        await fs.symlink(relativePath, latestFilepath);
        console.log(`Created symlink: ${latestFilename}`);
      }
    } catch (error) {
      console.warn(`Failed to update latest symlink: ${error.message}`);
      // Continue execution - this is not critical
    }
  }

  // Generate latest filename from session filename
  generateLatestFilename(filename) {
    // Extract base name and remove date/page info
    // e.g., "sandpoint-online-2025-08-07-page-1.json" -> "sandpoint-online-latest.json"
    // e.g., "eventbrite-events.json" -> "eventbrite-latest.json"
    
    let baseName = filename.replace(/\.json$/, '');
    
    // Remove date patterns (YYYY-MM-DD)
    baseName = baseName.replace(/-\d{4}-\d{2}-\d{2}/, '');
    
    // Remove page numbers
    baseName = baseName.replace(/-page-\d+/, '');
    
    // Remove trailing numbers/hyphens
    baseName = baseName.replace(/-+$/, '');
    
    return `${baseName}-latest.json`;
  }

  // Finalize session and create session summary
  async finalizeSession(metadata = {}) {
    if (!this.currentSession) {
      console.warn('No active session to finalize');
      return null;
    }
    
    const sessionSummary = {
      sessionId: this.currentSession.timestamp,
      startTime: this.currentSession.startTime,
      endTime: new Date().toISOString(),
      files: this.currentSession.files,
      totalEvents: this.currentSession.files.reduce((sum, file) => sum + file.eventCount, 0),
      metadata: {
        scraper: this.constructor.name,
        ...metadata
      }
    };
    
    const summaryPath = path.join(this.currentSession.sessionDir, 'session-summary.json');
    await fs.writeJson(summaryPath, sessionSummary, { spaces: 2 });
    
    console.log(`Session finalized: ${this.currentSession.timestamp}`);
    console.log(`Total events in session: ${sessionSummary.totalEvents}`);
    
    const completedSession = { ...this.currentSession, summary: sessionSummary };
    this.currentSession = null;
    
    return completedSession;
  }

  // Load events from JSON file (checks latest directory first, then falls back to legacy)
  async loadEvents(filename) {
    // Try latest directory first
    const latestFilename = this.generateLatestFilename(filename);
    const latestFilepath = path.join(this.latestDir, latestFilename);
    
    if (await fs.pathExists(latestFilepath)) {
      return await fs.readJson(latestFilepath);
    }
    
    // Fall back to legacy flat structure
    const legacyFilepath = path.join(this.dataDir, filename);
    if (await fs.pathExists(legacyFilepath)) {
      return await fs.readJson(legacyFilepath);
    }
    
    return [];
  }

  // Load events from a specific session
  async loadEventsFromSession(sessionId, filename) {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    const filepath = path.join(sessionDir, filename);
    
    if (await fs.pathExists(filepath)) {
      return await fs.readJson(filepath);
    }
    
    return [];
  }

  // List available sessions
  async listSessions() {
    try {
      const sessions = await fs.readdir(this.sessionsDir);
      return sessions.filter(session => {
        // Filter out non-directory items and invalid session names
        const sessionPath = path.join(this.sessionsDir, session);
        return fs.statSync(sessionPath).isDirectory() && 
               /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(session);
      }).sort().reverse(); // Most recent first
    } catch (error) {
      console.error('Error listing sessions:', error.message);
      return [];
    }
  }

  // Get session summary
  async getSessionSummary(sessionId) {
    const summaryPath = path.join(this.sessionsDir, sessionId, 'session-summary.json');
    
    if (await fs.pathExists(summaryPath)) {
      return await fs.readJson(summaryPath);
    }
    
    return null;
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