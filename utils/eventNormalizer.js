const crypto = require('crypto');
const { parseISO } = require('date-fns');

class EventNormalizer {
  constructor() {
    // Canonical tag list (all lowercase)
    this.canonicalTags = {
      'music': ['music', 'Music'],
      'art': ['art', 'Art'],
      'live': ['live', 'Live'],
      'community': ['community', 'Community'],
      'event': ['event', 'Event'],
      'food': ['food', 'Food'],
      'outdoors': ['outdoors', 'Outdoors'],
      'festival': ['festival', 'Festival'],
      'theater': ['theater', 'theatre'],
      'youth': ['youth'],
      'performance': ['performance'],
      'family': ['family'],
      'movies': ['movies'],
      'outdoor': ['outdoor'],
      'free': ['free'],
      'drama': ['drama'],
      'adult': ['adult'],
      'arts': ['arts'],
      'crafts': ['crafts'],
      'fair': ['fair'],
      'charity': ['charity'],
      'motorcycle': ['motorcycle'],
      'bbq': ['bbq'],
      'fundraiser': ['fundraiser', 'Fundraiser'],
      'beer': ['beer'],
      'tour': ['tour'],
      'self-guided': ['self-guided'],
      'blues': ['blues'],
      'multi-day': ['multi-day']
    };

    // Generic venue terms that should be locationNote instead
    this.genericVenueTerms = [
      'downtown', 'various', 'citywide', 'online', 'virtual',
      'sandpoint', 'area', 'multiple', 'locations', 'studios',
      'venues', 'throughout'
    ];

    // Default source mappings
    this.sourceNormalizations = {
      'sandpoint-online': 'Sandpoint Online',
      'Sandpoint Online': 'Sandpoint Online',
      'schweitzer': 'Schweitzer Mountain Resort',
      'Schweitzer Mountain Resort': 'Schweitzer Mountain Resort'
    };
  }

  normalizeEvent(event) {
    // Create a clean normalized event
    const normalized = { ...event };

    // 1. Fix field naming consistency
    this.normalizeFieldNames(normalized);

    // 2. Normalize source
    this.normalizeSource(normalized);

    // 3. Fix date/time schema
    this.normalizeDateTimeSchema(normalized);

    // 4. Fix venue vs location
    this.normalizeVenueLocation(normalized);

    // 5. Normalize tags
    this.normalizeTags(normalized);

    // 6. Generate stable ID
    this.generateStableId(normalized);

    // 7. Set review requirements
    this.setReviewRequirements(normalized);

    // 8. Clean up text
    this.cleanTextFields(normalized);

    return normalized;
  }

  normalizeFieldNames(event) {
    // Convert scraped_at to scrapedAt
    if (event.scraped_at && !event.scrapedAt) {
      event.scrapedAt = event.scraped_at;
      delete event.scraped_at;
    }
  }

  normalizeSource(event) {
    if (event.source && this.sourceNormalizations[event.source]) {
      event.source = this.sourceNormalizations[event.source];
    }
  }

  normalizeDateTimeSchema(event) {
    // Ensure startDate exists
    if (!event.startDate && event.date) {
      event.startDate = event.date;
    }

    // Keep the legacy date field for backward compatibility
    if (!event.date && event.startDate) {
      event.date = event.startDate;
    }

    // Validate dates
    if (event.startDate && !this.isValidISODate(event.startDate)) {
      event.needsReview = true;
    }

    if (event.endDate && !this.isValidISODate(event.endDate)) {
      event.needsReview = true;
    }
  }

  normalizeVenueLocation(event) {
    if (event.venue && event.venue.name) {
      const venueName = event.venue.name.toLowerCase();
      
      // Check if venue name contains generic terms
      const hasGenericTerms = this.genericVenueTerms.some(term => 
        venueName.includes(term)
      );

      if (hasGenericTerms) {
        // Move to locationNote
        event.locationNote = event.venue.name;
        event.venue = null;
      } else {
        // Clean up venue name (fix apostrophes, etc.)
        event.venue.name = this.cleanVenueName(event.venue.name);
      }
    }

    // Handle cases where venue is just a string
    if (typeof event.venue === 'string') {
      const venueName = event.venue.toLowerCase();
      const hasGenericTerms = this.genericVenueTerms.some(term => 
        venueName.includes(term)
      );

      if (hasGenericTerms) {
        event.locationNote = event.venue;
        event.venue = null;
      } else {
        // Convert to proper venue object
        event.venue = {
          name: this.cleanVenueName(event.venue),
          address: "",
          city: "Sandpoint",
          state: "ID",
          zipCode: "",
          phone: "",
          website: ""
        };
      }
    }
  }

  cleanVenueName(name) {
    // Fix common venue name issues
    return name
      .replace(/([a-z])'([a-z])/gi, "$1'$2")  // Fix apostrophes: "Connies" -> "Connie's"
      .replace(/\s+/g, ' ')  // Fix multiple spaces
      .trim();
  }

  normalizeTags(event) {
    if (!event.tags || !Array.isArray(event.tags)) {
      event.tags = [];
      return;
    }

    const normalizedTags = new Set();

    event.tags.forEach(tag => {
      // Find the canonical form of this tag
      for (const [canonical, variants] of Object.entries(this.canonicalTags)) {
        if (variants.includes(tag)) {
          normalizedTags.add(canonical);
          break;
        }
      }
    });

    event.tags = Array.from(normalizedTags).sort();
  }

  generateStableId(event) {
    // Only replace auto-### style IDs
    if (event.id && event.id.startsWith('auto-')) {
      // Create stable hash from key fields
      const hashInput = [
        event.source || '',
        event.referenceUrl || '',
        event.startDate || event.date || '',
        event.title || ''
      ].join('|').toLowerCase();

      const hash = crypto.createHash('md5').update(hashInput).digest('hex');
      event.id = `stable-${hash.substring(0, 8)}`;
    }
  }

  setReviewRequirements(event) {
    let needsReview = false;

    // Missing reference URL
    if (!event.referenceUrl && event.source === 'Sandpoint Online') {
      event.referenceUrl = 'https://sandpointonline.com/current/index.shtml';
    }
    if (!event.referenceUrl) {
      needsReview = true;
    }

    // Missing image - only flag for review if source typically provides images
    // Sandpoint Online doesn't provide images, so don't flag those events
    if (!event.image && !event.imageUrl && event.source !== 'Sandpoint Online') {
      needsReview = true;
    }

    // Garbled or very short description
    if (!event.description || event.description.length < 20) {
      needsReview = true;
    }

    // Date/time consistency validation
    if (this.hasDateTimeMismatch(event)) {
      needsReview = true;
    }

    // Missing time when description contains time clues
    if (!event.startTime && this.containsTimeClues(event.description)) {
      needsReview = true;
    }

    // Garbled text detected
    if (this.hasGarbledText(event)) {
      needsReview = true;
    }

    // Set needsReview if not already set
    if (event.needsReview === undefined) {
      event.needsReview = needsReview;
    } else if (needsReview) {
      // Always set to true if we detected issues
      event.needsReview = true;
    }
  }

  containsTimeClues(text) {
    if (!text) return false;
    
    const timePatterns = [
      /\d{1,2}\s*[ap]\.?m\.?/i,
      /\d{1,2}:\d{2}/,
      /at\s+\d+/i,
      /from\s+\d+/i,
      /starting\s+at\s+\d+/i
    ];

    return timePatterns.some(pattern => pattern.test(text));
  }

  hasGarbledText(event) {
    const garbledPatterns = [
      /\.\s*\w{1,2}\s*\./,  // ". o .", ". p ."
      /\w+\s+\w+\s+the\s+Original\s+Sin$/,  // Double spaces in names
      /you may wan\./,  // Truncated sentences
      /\s{2,}/,  // Multiple spaces
      /[A-Z]{2,}\s+[A-Z]{2,}/  // Multiple consecutive caps
    ];

    const textFields = [event.title, event.description, event.performer];
    
    return textFields.some(field => 
      field && garbledPatterns.some(pattern => pattern.test(field))
    );
  }

  cleanTextFields(event) {
    // Clean title
    if (event.title) {
      event.title = event.title
        .replace(/\s+/g, ' ')  // Fix multiple spaces
        .replace(/\s+&\s+/g, ' & ')  // Fix spacing around ampersands
        .trim();
    }

    // Clean description
    if (event.description) {
      event.description = event.description
        .replace(/\s+/g, ' ')  // Fix multiple spaces
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add space between camelCase
        .trim();
    }

    // Clean performer
    if (event.performer) {
      event.performer = event.performer
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  isValidISODate(dateString) {
    try {
      const date = parseISO(dateString);
      return !isNaN(date.getTime());
    } catch (error) {
      return false;
    }
  }

  hasDateTimeMismatch(event) {
    if (!event.startDate) {
      return false; // Can't validate without startDate
    }

    try {
      const eventDate = parseISO(event.startDate);
      
      // Case 1: Event has startTime - validate time consistency
      if (event.startTime) {
        const [hours, minutes] = event.startTime.split(':').map(Number);
        
        // Check for suspicious patterns:
        // 1. Evening startTime (17:00+) but date shows early morning (00:00-10:00 UTC)
        if (hours >= 17 && eventDate.getUTCHours() <= 10) {
          return true;
        }
        
        // 2. Morning startTime (06:00-12:00) but date shows late evening UTC
        if (hours >= 6 && hours <= 12 && eventDate.getUTCHours() >= 18) {
          return true;
        }

        // 3. Default midnight dates with specific times (likely parsing error)
        if ((eventDate.getUTCHours() === 7 || eventDate.getUTCHours() === 0) && 
            eventDate.getUTCMinutes() === 0 && 
            eventDate.getUTCSeconds() === 0) {
          return true;
        }
      }
      
      // Case 2: No startTime but description contains evening time clues + suspect timestamp  
      if (!event.startTime) {
        const description = event.description || '';
        const eveningPatterns = [
          /dusk/i,
          /evening/i,
          /8[\s:-]*45\s*p\.?m\.?/i,
          /[8-9][\s:-]*\d{0,2}\s*p\.?m\.?/i,  // 8pm, 8:30pm, 9pm
          /sunset/i,
          /after\s*dark/i,
          /under\s+the\s+stars/i  // Movies on the Mountain specific
        ];
        
        const hasEveningClues = eveningPatterns.some(pattern => pattern.test(description));
        
        if (hasEveningClues) {
          // Check if timestamp suggests daytime (morning/afternoon in PDT)
          // 19:30 UTC = 12:30 PM PDT (suspicious for evening events)
          // 07:00 UTC = 12:00 AM PDT (default midnight)
          // 00:00 UTC = 5:00 PM PDT (could be correct evening time)
          const utcHours = eventDate.getUTCHours();
          const utcMinutes = eventDate.getUTCMinutes();
          const utcSeconds = eventDate.getUTCSeconds();
          
          // Flag if:
          // 1. Default midnight parsing (7:00 or 0:00 UTC with 0 minutes/seconds)
          // 2. Suspicious afternoon times (19:00-20:00 UTC = 12:00-1:00 PM PDT)
          if ((utcHours === 7 || utcHours === 0) && utcMinutes === 0 && utcSeconds === 0) {
            return true; // Default parsing with evening clues
          }
          if (utcHours >= 19 && utcHours <= 20 && utcMinutes >= 0 && utcMinutes <= 59) {
            return true; // Afternoon time with evening clues (likely wrong)
          }
        }
      }

      return false;
    } catch (error) {
      return true; // Flag for review if we can't parse
    }
  }
}

module.exports = EventNormalizer;