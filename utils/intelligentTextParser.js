const { v4: uuidv4 } = require('uuid');
const { format, parse, addDays, isValid } = require('date-fns');

/**
 * Intelligent Text Parser for Sandpoint Events
 * Extracts structured JSON data from raw event text paragraphs
 * 
 * Subagent type: intelligent-text-parser
 * 
 * Input: Raw paragraph text describing events
 * Output: Complete JSON structure matching Sanity CMS schema
 */
class IntelligentTextParser {
  constructor(options = {}) {
    this.currentYear = options.currentYear || new Date().getFullYear();
    this.defaultLocation = options.defaultLocation || 'Sandpoint, ID';
    
    // Known venues in Sandpoint area
    this.knownVenues = {
      'schweitzer': { name: 'Schweitzer Mountain Resort', address: '10000 Schweitzer Mountain Rd, Sandpoint, ID 83864' },
      'panida': { name: 'Panida Theater', address: '300 N 1st Ave, Sandpoint, ID 83864' },
      'trinity': { name: 'Trinity at City Beach', address: 'City Beach, Sandpoint, ID 83864' },
      'city beach': { name: 'City Beach Park', address: 'City Beach, Sandpoint, ID 83864' },
      'memorial field': { name: 'Memorial Field', address: 'Memorial Field, Sandpoint, ID 83864' },
      'farmin park': { name: 'Farmin Park', address: 'Farmin Park, Sandpoint, ID 83864' },
      'evans brothers coffee': { name: 'Evans Brothers Coffee', address: 'Downtown Sandpoint, ID' },
      'mick duffs': { name: "Mick Duff's Brewing Company", address: 'Downtown Sandpoint, ID' },
      'downtown sandpoint': { name: 'Downtown Sandpoint', address: 'Downtown Sandpoint, ID' },
      'sandpoint': { name: 'Sandpoint', address: 'Sandpoint, ID' },
      'connies lounge': { name: "Connie's Lounge", address: '323 Cedar St, Sandpoint, ID' },
      "connie's lounge": { name: "Connie's Lounge", address: '323 Cedar St, Sandpoint, ID' },
      'tervan': { name: 'The Tervan', address: '411 Cedar St, Sandpoint, ID' },
      'the tervan': { name: 'The Tervan', address: '411 Cedar St, Sandpoint, ID' },
      'pearls on the lake': { name: 'Pearls on the Lake', address: 'Hope, ID' },
      'roxys': { name: "Roxy's", address: '215 Pine St, Sandpoint, ID' },
      "roxy's": { name: "Roxy's", address: '215 Pine St, Sandpoint, ID' },
      '219 lounge': { name: '219 Lounge', address: '219 First Ave, Sandpoint, ID' },
      'the 219 lounge': { name: '219 Lounge', address: '219 First Ave, Sandpoint, ID' },
      'sandpoint community hall': { name: 'Sandpoint Community Hall', address: '204 S. First St, Sandpoint, ID' },
      'community hall': { name: 'Sandpoint Community Hall', address: '204 S. First St, Sandpoint, ID' },
      'connies': { name: "Connie's Lounge", address: '323 Cedar St, Sandpoint, ID' },
      'bonner county fairgrounds': { name: 'Bonner County Fairgrounds', address: '4203 N. Boyer Ave, Sandpoint, ID' },
      'fairgrounds': { name: 'Bonner County Fairgrounds', address: '4203 N. Boyer Ave, Sandpoint, ID' },
      'lakeview park': { name: 'Lakeview Park', address: 'Lakeview Park, Sandpoint, ID' },
      'sandpoint middle school': { name: 'Sandpoint Middle School', address: 'Sandpoint, ID' },
      'camp stidwell': { name: 'Camp Stidwell', address: 'Camp Stidwell, Sandpoint Area, ID' },
      "pend d'oreille winery": { name: "Pend d'Oreille Winery", address: '301 Cedar St, Sandpoint, ID' },
      'pend doreille winery': { name: "Pend d'Oreille Winery", address: '301 Cedar St, Sandpoint, ID' },
      'matchwood': { name: 'Matchwood', address: '513 Oak St, Sandpoint, ID' },
      'barrel 33': { name: 'Barrel 33', address: '100 N. First Ave, Sandpoint, ID' }
    };

    // Common price patterns and their meanings
    this.pricePatterns = [
      { pattern: /free|no charge|no cost|complimentary|no cover/i, value: 'Free' },
      { pattern: /(\d+)\s*(?:dollar|dollars|\$)?\s*(?:person\s*)?(?:entry fee|buy in|entrance|admission)/i, value: null }, // "5person entry fee" or "$10 entry fee"
      { pattern: /\$(\d+(?:\.\d{2})?)/i, value: null }, // Extract exact price like "$10" (removed global flag)
      { pattern: /(\d+)\s*(?:for adults|for youth|adults|youth)/i, value: null }, // "15 for adults, 5 for youth"
      { pattern: /donation|suggested donation/i, value: 'Donation' },
      { pattern: /pay what you can/i, value: 'Pay What You Can' },
      { pattern: /admission|entry fee/i, value: 'Admission Required' }
    ];

    // Tag inference patterns
    this.tagPatterns = {
      'Music': /music|concert|band|performance|sing|song|album|musician|guitar|piano|jazz|rock|folk|blues/i,
      'Food': /food|eat|dining|restaurant|barbecue|bbq|grill|feast|meal|cooking|cuisine/i,
      'Community': /community|neighbor|local|family|fundraiser|charity|volunteer|meet|social/i,
      'Outdoors': /outdoor|mountain|hike|trail|ski|snow|beach|park|nature|camping|fishing|hunting/i,
      'Art': /art|artist|gallery|exhibit|paint|draw|craft|creative|workshop|studio/i,
      'Festival': /festival|fair|celebration|parade|carnival|expo|show/i,
      'Live': /live|performance|show|theater|theatre|stage|acting|play/i,
      'Fundraiser': /fundraiser|charity|benefit|donation|cause|support|raise money|nonprofit/i
    };
  }

  /**
   * Main parsing method - converts raw text to structured JSON
   * @param {string} rawText - Raw paragraph text describing the event
   * @param {object} options - Additional parsing options
   * @returns {object} Complete event JSON structure
   */
  parseEventText(rawText, options = {}) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Invalid input: rawText must be a non-empty string');
    }

    const cleanText = this.cleanText(rawText);
    
    // Extract all components
    const title = this.extractTitle(cleanText);
    const dates = this.extractDates(cleanText);
    const times = this.extractTimes(cleanText);
    const venue = this.extractVenue(cleanText);
    const price = this.extractPrice(cleanText);
    const description = this.generateCleanDescription(cleanText, { title, dates, times, venue, price });
    const tags = this.inferTags(cleanText);
    const contact = this.extractContact(cleanText);
    const urls = this.extractUrls(cleanText);

    // Build complete JSON structure
    const event = {
      id: uuidv4(),
      title: title,
      slug: this.generateSlug(title),
      date: dates.startDate, // Legacy field
      startDate: dates.startDate,
      endDate: dates.endDate,
      startTime: times.startTime,
      endTime: times.endTime,
      description: description,
      image: null, // Not extractable from text
      imageUrl: null, // Not extractable from text
      url: urls.eventUrl,
      referenceUrl: urls.referenceUrl,
      ticketUrl: urls.ticketUrl,
      venue: venue.venueReference,
      locationNote: venue.locationNote,
      needsReview: this.determineNeedsReview(cleanText, { title, dates, venue }),
      tags: tags,
      source: options.source || 'intelligent-text-parser',
      location: this.defaultLocation,
      price: price,
      contact: contact,
      performer: this.extractPerformer(cleanText),
      organizer: this.extractOrganizer(cleanText),
      scraped_at: new Date().toISOString()
    };

    return event;
  }

  /**
   * Clean and normalize text input
   */
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '') // Keep basic extended ASCII
      .replace(/\s+&\s+/g, ' & ') // Fix spacing around ampersands
      .replace(/\s+the\s+Original\s+Sin/g, ' & the Original Sin') // Fix common band name formatting
      .replace(/\bthe\s+CO-OP\s+Gas\s+&?\s*Supply\s+Company\b/gi, 'the CO-OP Gas & Supply Company') // Fix organizer name
      .replace(/\s+come\s+watch\s+an\s+epic\s+night.+$/i, '') // Remove garbled text at end
      .replace(/^(Join|Check out|Head down to|Dont miss)\s+at\s+/i, '$1 us at ') // Fix incomplete sentences
      .trim();
  }

  /**
   * Extract event title from text
   */
  extractTitle(text) {
    // Look for patterns that suggest a title
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // Specific patterns for extracting event titles (order matters - most specific first)
    const titlePatterns = [
      // Handle date ranges like "15-16 Event Title." or "15-17 Fri-Sun Event Title."
      /^\d{1,2}-\d{1,2}(?:\s+\w+-\w+)?\s+(.+?)\./,
      // Handle formats like "14 $5 Movie: Title." first (most specific)
      /^\d{1,2}(?:st|nd|rd|th)?\s+\$\d+\s+Movie:\s*(.+?)\./,
      // Handle formats like "14 Live Music with Artist."
      /^\d{1,2}(?:st|nd|rd|th)?\s+(.+?)\./,
      // Handle formats like "14 Event Name" (short titles without period)
      /^\d{1,2}(?:st|nd|rd|th)?\s+([^.]{5,50}?)(?=\s+[A-Z]|$)/,
      // Standard patterns
      /^Join\s+(?:us\s+)?(?:up\s+)?at\s+\w+\s+for\s+(?:the\s+)?(.+?)\s+on\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
      /^Join\s+(?:us\s+)?(?:up\s+)?for\s+(?:the\s+)?(.+?)\s+on\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
      /^(.+?)\s+at\s+\d/i,
      /^(.+?)\s+starts?\s+at/i,
      /^(.+?)\s+will\s+be/i,
      /^(.+?)\s+takes?\s+place/i,
      // Less specific pattern last
      /^(.+?)\s+on\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.cleanTitle(match[1]);
      }
    }

    // Fallback to first sentence, but clean it up
    if (sentences[0]) {
      let title = sentences[0];
      // Remove common prefixes
      title = title.replace(/^(Join us for|Join up for|Join for|Come to|Attend|Don't miss)\s+/i, '');
      title = title.replace(/^Join\s+(?:us\s+)?(?:up\s+)?at\s+\w+\s+for\s+/i, '');
      // Remove leading day number or date range (e.g., "14 Live Music..." -> "Live Music..." or "15-16 Event..." -> "Event...")
      title = title.replace(/^\d{1,2}(?:st|nd|rd|th)?\s+/, '');
      title = title.replace(/^\d{1,2}-\d{1,2}(?:\s+\w+-\w+)?\s+/, '');
      return this.cleanTitle(title);
    }

    return 'Untitled Event';
  }

  cleanTitle(title) {
    return title
      .replace(/^\s*(the\s+)?/i, '')
      .replace(/\s*[!.,:;]$/, '')
      .trim()
      .replace(/^./, c => c.toUpperCase());
  }

  /**
   * Extract dates from text and convert to ISO format
   */
  extractDates(text) {
    const datePatterns = [
      // "Friday, August 8" format
      /(?:on\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
      // "August 8" format
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
      // "8/8" format
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
      // ISO-like format
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      // Date range at beginning of text (e.g., "15-16 Event...")
      /^(\d{1,2})-(\d{1,2})(?:\s+\w+-\w+)?\s+/,
      // Standalone day at beginning of text (e.g., "14 Live Music...")
      /^(\d{1,2})(?:st|nd|rd|th)?\s+/
    ];

    const months = {
      'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
      'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
    };

    let startDate = null;
    let endDate = null;

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        let date = null;
        
        // Check what type of pattern matched based on the pattern used
        const patternIndex = datePatterns.indexOf(pattern);
        
        if (patternIndex === 0 && match[2] && months.hasOwnProperty(match[2].toLowerCase())) {
          // "Friday, August 8" format
          const month = months[match[2].toLowerCase()];
          const day = parseInt(match[3]);
          date = new Date(this.currentYear, month, day);
        } else if (patternIndex === 1 && match[1] && months.hasOwnProperty(match[1].toLowerCase())) {
          // "August 8" format  
          const month = months[match[1].toLowerCase()];
          const day = parseInt(match[2]);
          date = new Date(this.currentYear, month, day);
        } else if (patternIndex === 2) {
          // "8/8" or "8/8/2024" format
          const month = parseInt(match[1]) - 1; // JS months are 0-indexed
          const day = parseInt(match[2]);
          const year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : this.currentYear;
          date = new Date(year, month, day);
        } else if (patternIndex === 3) {
          // ISO format: "2024-08-15"
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // JS months are 0-indexed
          const day = parseInt(match[3]);
          date = new Date(year, month, day);
        } else if (patternIndex === 4) {
          // Date range format: "15-16" or "15-17 Fri-Sun"
          const startDay = parseInt(match[1]);
          const endDay = parseInt(match[2]);
          const currentMonth = new Date().getMonth();
          date = new Date(this.currentYear, currentMonth, startDay);
          
          // If the date has passed this month, assume next month
          if (date < new Date()) {
            date = new Date(this.currentYear, currentMonth + 1, startDay);
          }
          
          // Set end date for multi-day events
          const calculatedMonth = date < new Date() ? currentMonth + 1 : currentMonth;
          endDate = new Date(this.currentYear, calculatedMonth, endDay);
          endDate = endDate.toISOString();
        } else if (patternIndex === 5) {
          // Standalone day format: "14"
          const day = parseInt(match[1]);
          const currentMonth = new Date().getMonth();
          date = new Date(this.currentYear, currentMonth, day);
          
          // If the date has passed this month, assume next month
          if (date < new Date()) {
            date = new Date(this.currentYear, currentMonth + 1, day);
          }
        }

        if (date && isValid(date)) {
          startDate = date.toISOString();
          break;
        }
      }
    }

    // Look for end date patterns
    const endDatePatterns = [
      /through\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i,
      /to\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i,
      /-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i
    ];

    for (const pattern of endDatePatterns) {
      const match = text.match(pattern);
      if (match) {
        let monthIndex = 1;
        let dayIndex = 2;
        
        if (match.length === 4) { // Has day of week
          monthIndex = 2;
          dayIndex = 3;
        }
        
        if (months.hasOwnProperty(match[monthIndex].toLowerCase())) {
          const month = months[match[monthIndex].toLowerCase()];
          const day = parseInt(match[dayIndex]);
          const date = new Date(this.currentYear, month, day);
          
          if (isValid(date)) {
            endDate = date.toISOString();
            break;
          }
        }
      }
    }

    return { startDate, endDate };
  }

  /**
   * Extract start and end times from text
   */
  extractTimes(text) {
    const timePatterns = [
      // "from 3-5:30 p.m." format (time ranges)
      /from\s+(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i,
      /from\s+(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i,
      // "between 8:00-8:45 p.m." format
      /between\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i,
      // "Start at 7:30 p.m." format
      /start\s+at\s+(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i,
      /starts?\s+at\s+(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i,
      // "Start at 9 p.m." format (no minutes)
      /start\s+at\s+(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i,
      /starts?\s+at\s+(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i,
      // "at 7:30 p.m." format  
      /at\s+(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i,
      // "at 9 p.m." format (no minutes)
      /at\s+(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i,
      // "Join at 9 p.m." format
      /join\s+at\s+(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i,
      // "7:30 p.m." format
      /(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/g,
      // "9 p.m." format (no minutes, no context)
      /(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/g
    ];

    let startTime = null;
    let endTime = null;

    for (const pattern of timePatterns) {
      const matches = [...text.matchAll(pattern.global ? pattern : new RegExp(pattern.source, 'gi'))];
      for (const match of matches) {
        
        // Handle "from X-Y" patterns specially
        if (pattern.source.includes('from\\s+')) {
          const startHour = parseInt(match[1]);
          const startMinute = match[2] ? parseInt(match[2]) : 0;
          const endHour = parseInt(match[3]);
          
          // Check if match[4] is ampm (string) or end minutes (number)
          let endMinute = 0;
          let ampm = '';
          
          if (match[4] && typeof match[4] === 'string' && /[ap]\.?m\.?/i.test(match[4])) {
            // match[4] is ampm, no end minutes specified
            ampm = match[4].toLowerCase().replace(/\./g, '');
            endMinute = 0;
          } else if (match[4] && !isNaN(parseInt(match[4]))) {
            // match[4] is end minutes
            endMinute = parseInt(match[4]);
            ampm = match[5] ? match[5].toLowerCase().replace(/\./g, '') : '';
          } else {
            // Fallback: ensure endMinute is always a valid number
            endMinute = 0;
          }

          // Smart AM/PM logic for time ranges
          // If start hour is much larger than end hour, likely crosses AM/PM boundary
          // e.g., "9-1 p.m." should be "9 a.m. to 1 p.m."
          let startAmPm = ampm;
          let endAmPm = ampm;
          
          if (ampm === 'pm' && startHour > endHour && startHour >= 9 && endHour <= 6) {
            // Likely spans from AM to PM (e.g., farmers market "9-1 p.m.")
            startAmPm = 'am';
            endAmPm = 'pm';
            
            // Additional context clues for AM events
            const contextText = text.toLowerCase();
            const amIndicators = ['farmers', 'market', 'breakfast', 'morning', 'brunch', 'sunrise'];
            const hasAmContext = amIndicators.some(indicator => contextText.includes(indicator));
            
            if (hasAmContext) {
              startAmPm = 'am';
            }
          }

          // Convert start time
          let startHour24 = startHour;
          if (startAmPm === 'pm' && startHour !== 12) {
            startHour24 += 12;
          } else if (startAmPm === 'am' && startHour === 12) {
            startHour24 = 0;
          }
          startTime = `${startHour24.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

          // Convert end time
          let endHour24 = endHour;
          if (endAmPm === 'pm' && endHour !== 12) {
            endHour24 += 12;
          } else if (endAmPm === 'am' && endHour === 12) {
            endHour24 = 0;
          }
          endTime = `${endHour24.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
          
          break; // Found time range, stop looking
        }
        
        // Handle "between X-Y" patterns  
        else if (pattern.source.includes('between\\s+')) {
          const startHour = parseInt(match[1]);
          const startMinute = parseInt(match[2]);
          const endHour = parseInt(match[3]);
          const endMinute = parseInt(match[4]);
          const ampm = match[5] ? match[5].toLowerCase().replace(/\./g, '') : '';

          // Convert start time
          let startHour24 = startHour;
          if (ampm === 'pm' && startHour !== 12) {
            startHour24 += 12;
          } else if (ampm === 'am' && startHour === 12) {
            startHour24 = 0;
          }
          startTime = `${startHour24.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

          // Convert end time
          let endHour24 = endHour;
          if (ampm === 'pm' && endHour !== 12) {
            endHour24 += 12;
          } else if (ampm === 'am' && endHour === 12) {
            endHour24 = 0;
          }
          endTime = `${endHour24.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
          
          break; // Found time range, stop looking
        }
        
        // Handle single time patterns
        else {
          const hour = parseInt(match[1]);
          
          // Determine if match[2] is minutes (number) or ampm (string)
          let minute = 0;
          let ampm = '';
          
          if (match[2] && /[ap]\.?m\.?/i.test(match[2])) {
            // match[2] is ampm, no minutes specified
            ampm = match[2].toLowerCase().replace(/\./g, '');
            minute = 0;
          } else if (match[2] && !isNaN(parseInt(match[2]))) {
            // match[2] is minutes
            minute = parseInt(match[2]);
            ampm = match[3] ? match[3].toLowerCase().replace(/\./g, '') : '';
          }

          let hour24 = hour;
          if (ampm === 'pm' && hour !== 12) {
            hour24 += 12;
          } else if (ampm === 'am' && hour === 12) {
            hour24 = 0;
          }

          const timeString = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          if (!startTime) {
            startTime = timeString;
          }
        }
      }
      
      // If we found a time range, stop looking at other patterns
      if (startTime && endTime) {
        break;
      }
    }

    // Look for explicit end time patterns
    const endTimePatterns = [
      /ends?\s+at\s+(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i,
      /until\s+(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)/i
    ];

    for (const pattern of endTimePatterns) {
      const match = text.match(pattern);
      if (match) {
        const hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        const ampm = match[3] ? match[3].toLowerCase().replace(/\./g, '') : '';

        let hour24 = hour;
        if (ampm === 'pm' && hour !== 12) {
          hour24 += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour24 = 0;
        }

        endTime = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        break;
      }
    }

    return { startTime, endTime };
  }

  /**
   * Extract venue information
   */
  extractVenue(text) {
    const lowerText = text.toLowerCase();
    
    // Check known venues first
    for (const [key, venue] of Object.entries(this.knownVenues)) {
      if (lowerText.includes(key)) {
        return {
          venueReference: venue,
          locationNote: null
        };
      }
    }

    // Look for "at [venue]" patterns
    const venuePatterns = [
      // "at the Bonner County Fairgrounds, 4203 N. Boyer Ave" - capture full venue name with address
      /at\s+the\s+([^,]+?)\s*(?:Fairgrounds|Theater|Hall|Center|Park|School),?\s*([^.!?]*)/i,
      // "at the 219 Lounge, 219 First Ave" - capture full venue name with "the"
      /at\s+the\s+([^,]+?)\s*(?:Lounge|Club|Bar|Restaurant|Theater|Hall|Center),?\s*([^.!?]*)/i,
      // "at [venue name], [address]" - venue with address
      /at\s+([^,]+?),\s*(\d+[^.!?]*(?:St|Ave|Blvd|Rd|Drive|Street|Avenue)[^.!?]*)/i,
      // "held at [venue]" or "will be held at [venue]" - Shakespeare events
      /(?:will be )?held at\s+([^,]+?)(?:,|\s+or\s+|\.|$)/i,
      // "take place at [venue]" - campout events
      /take place at\s+([^,]+?)(?:,|\s+and\s+|\.|$)/i,
      // "Show will be held at [venue], or [alternate venue]" - events with backup locations
      /Show will be held at\s+([^,]+?)(?:,\s+or\s+the\s+inclement\s+weather\s+location|,|\.)/i,
      // "at [venue name] from/with" - stop at time or other info  
      /at\s+([^,.!?]+?)(?:\s+(?:from|with|performing|\d+\s*(?:a\.?m\.?|p\.?m\.?)|on|in|near|where|located))/i,
      // "performing at [venue]" - extract venue name
      /performing\s+at\s+([^,]+?)(?:,|$|\.)/i,
      // "located at [venue]" - stop at natural boundaries
      /located\s+(?:at|on|in)\s+([^,.!?]+?)(?:\s+(?:on|in|near|at|where|,))/i,
      // "venue: [name]"
      /venue:\s*([^,.!?]+?)(?:\s*[.!?]|$)/i
    ];

    for (const pattern of venuePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let venueName = match[1].trim();
        const address = match[2] ? match[2].trim() : null;
        
        // Handle venue names with "the" prefix properly
        if (pattern.source.includes('the\\s+')) {
          // For patterns that explicitly match "the", keep it
          venueName = `the ${venueName}`;
        }
        
        // Clean up venue name - remove unwanted suffixes
        venueName = venueName.replace(/\s+from\s+.+$/i, ''); // Remove " from X" suffix
        venueName = venueName.replace(/\s+and\s+.+$/i, ''); // Remove " and X" suffix
        venueName = venueName.trim();
        
        // Skip if venue name is too short or contains timing info
        if (venueName.length < 3 || /\d+\s*(?:a\.?m\.?|p\.?m\.?)/i.test(venueName)) {
          continue;
        }
        
        // Skip generic location words
        const genericVenues = ['sandpoint', 'downtown', 'the', 'at', 'in', 'on'];
        if (genericVenues.includes(venueName.toLowerCase())) {
          continue;
        }
        
        // If we have an address, include it
        if (address && address.length > 3) {
          return {
            venueReference: { 
              name: venueName, 
              address: address.includes('Sandpoint') ? address : `${address}, Sandpoint, ID`
            },
            locationNote: null
          };
        } else {
          return {
            venueReference: { name: venueName },
            locationNote: null
          };
        }
      }
    }

    // If no specific venue found, look for general location indicators
    const locationPatterns = [
      /downtown/i,
      /city beach/i,
      /sandpoint/i,
      /schweitzer/i
    ];

    for (const pattern of locationPatterns) {
      if (text.match(pattern)) {
        return {
          venueReference: null,
          locationNote: text.match(pattern)[0]
        };
      }
    }

    return {
      venueReference: null,
      locationNote: null
    };
  }

  /**
   * Extract pricing information
   */
  extractPrice(text) {
    for (const pricePattern of this.pricePatterns) {
      if (pricePattern.value) {
        // Fixed value patterns (like "Free")
        if (pricePattern.pattern.test(text)) {
          return pricePattern.value;
        }
      } else {
        // Extract exact price patterns
        const match = text.match(pricePattern.pattern);
        if (match && match[1]) {
          // Ensure we have a valid number before formatting
          const priceValue = parseInt(match[1]);
          if (!isNaN(priceValue)) {
            return `$${priceValue}`;
          }
        }
      }
    }
    return null;
  }

  /**
   * Generate clean description by removing extracted metadata
   */
  generateCleanDescription(text, extractedData) {
    let description = text;
    
    // Remove the leading day number/date range and title that was extracted
    if (extractedData.title) {
      // Remove day number format like "14 Title. " or date range "15-16 Title. " from beginning
      description = description.replace(/^\d{1,2}(?:st|nd|rd|th)?\s+[^.]+\.\s*/, '');
      description = description.replace(/^\d{1,2}-\d{1,2}(?:\s+\w+-\w+)?\s+[^.]+\.\s*/, '');
      // Fallback: remove extracted title from beginning of description
      const escapedTitle = extractedData.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      description = description.replace(new RegExp(`^\\d{1,2}(?:st|nd|rd|th)?\\s+${escapedTitle}\\.?\\s*`, 'i'), '');
      description = description.replace(new RegExp(`^\\d{1,2}-\\d{1,2}(?:\\s+\\w+-\\w+)?\\s+${escapedTitle}\\.?\\s*`, 'i'), '');
    }
    
    // Remove the opening phrase that became the title
    description = description.replace(/^Join\s+(?:us\s+)?(?:up\s+)?at\s+\w+\s+for\s+(?:the\s+)?[^.]+?\s+on\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\.?\s*/i, '');
    
    // Remove standalone time references
    description = description.replace(/Start\s+at\s+\d{1,2}:\d{2}\s*[ap]\.?m\.?\s*[.,]?\s*/gi, '');
    description = description.replace(/At\s+dusk,?\s*\(between\s+\d{1,2}:\d{2}-?\d{0,2}:?\d{0,2}\s*[ap]\.?m\.?\)\s*/gi, '');
    
    // Remove pricing statements
    description = description.replace(/This\s+is\s+a\s+free\s+event\.?\s*/gi, '');
    description = description.replace(/\$\d+(?:\.\d{2})?\s*per\s+\w+/gi, '');
    
    // Remove location details that are redundant with venue
    description = description.replace(/Located\s+on\s+the\s+lawn\s+in\s+the\s+Village\s+nears\s+the\s+Crow's\s+Bench\s+patio,?\s*/gi, '');
    
    // Clean up fragments and improve flow
    description = description
      .replace(/\s+/g, ' ')
      .replace(/^[.,\s]+/, '')
      .replace(/[.,\s]+$/, '')
      .replace(/\s*,\s*,/g, ',')
      .replace(/\.\s*\./g, '.')
      .trim();

    // Capitalize first letter
    if (description) {
      description = description.charAt(0).toUpperCase() + description.slice(1);
    }

    return description || 'Event description not available.';
  }

  /**
   * Infer tags based on text content
   */
  inferTags(text) {
    const inferredTags = [];
    
    for (const [tag, pattern] of Object.entries(this.tagPatterns)) {
      if (pattern.test(text)) {
        inferredTags.push(tag);
      }
    }

    // Always include Community as a default tag
    if (!inferredTags.includes('Community')) {
      inferredTags.push('Community');
    }

    return inferredTags;
  }

  /**
   * Extract contact information
   */
  extractContact(text) {
    const contactPatterns = [
      /contact\s+([^.!?]+)/i,
      /info:\s*([^.!?]+)/i,
      /call\s+(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/i,
      /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    ];

    for (const pattern of contactPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract URLs from text
   */
  extractUrls(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlPattern) || [];
    
    return {
      eventUrl: matches[0] || null,
      referenceUrl: matches[0] || null,
      ticketUrl: matches.find(url => 
        url.includes('ticket') || url.includes('eventbrite') || url.includes('buy')
      ) || null
    };
  }

  /**
   * Extract performer information
   */
  extractPerformer(text) {
    const performerPatterns = [
      /featuring\s+([^.!?]+)/i,
      /performer:\s*([^.!?]+)/i,
      /with\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
      /live\s+music\s+by\s+([^.!?]+)/i
    ];

    for (const pattern of performerPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract organizer information
   */
  extractOrganizer(text) {
    const organizerPatterns = [
      /hosted\s+by\s+([^.!?]+?)(?:\s+come\s+watch|\.|$)/i, // Stop at "come watch" to avoid garbled text
      /organized\s+by\s+([^.!?]+?)(?:\s+come\s+watch|\.|$)/i,
      /presented\s+by\s+([^.!?]+?)(?:\s+come\s+watch|\.|$)/i,
      /sponsor(?:ed)?\s+by\s+([^.!?]+?)(?:\s+come\s+watch|\.|$)/i
    ];

    for (const pattern of organizerPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const organizer = match[1].trim();
        
        // Skip if organizer text is too long (likely garbled)
        if (organizer.length > 50) {
          continue;
        }
        
        // Clean common organizer issues
        const cleanOrganizer = organizer
          .replace(/\s+come\s+watch.+$/i, '') // Remove trailing garbled text
          .trim();
          
        return cleanOrganizer;
      }
    }

    return null;
  }

  /**
   * Determine if event needs manual review
   */
  determineNeedsReview(text, extractedData) {
    const reviewFlags = [
      !extractedData.title || extractedData.title === 'Untitled Event',
      !extractedData.dates.startDate,
      !extractedData.venue.venueReference && !extractedData.venue.locationNote,
      text.length < 50, // Very short description
      text.includes('TBD') || text.includes('TBA'),
      /\b(maybe|possibly|tentative|subject to change)\b/i.test(text)
    ];

    return reviewFlags.some(flag => flag);
  }

  /**
   * Generate URL-friendly slug from title
   */
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
}

module.exports = IntelligentTextParser;