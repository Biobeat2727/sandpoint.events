const fs = require('fs-extra');
const path = require('path');

class EventSummarizer {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.options = {
      maxSummaryLength: options.maxSummaryLength || 200,
      generateShortSummary: options.generateShortSummary !== false,
      improveExistingDescriptions: options.improveExistingDescriptions !== false,
      addKeywords: options.addKeywords !== false,
      ...options
    };
    
    this.results = {
      processed: 0,
      summariesGenerated: 0,
      descriptionsImproved: 0,
      errors: []
    };

    // Common event keywords for different categories
    this.eventKeywords = {
      music: ['concert', 'performance', 'band', 'acoustic', 'live music', 'songs', 'musician'],
      art: ['gallery', 'exhibition', 'artist', 'painting', 'sculpture', 'creative', 'artwork'],
      community: ['meeting', 'gathering', 'neighborhood', 'residents', 'community', 'local'],
      festival: ['festival', 'celebration', 'annual', 'tradition', 'heritage', 'cultural'],
      food: ['dining', 'restaurant', 'food', 'culinary', 'taste', 'cuisine', 'chef'],
      outdoors: ['outdoor', 'nature', 'hiking', 'lake', 'beach', 'park', 'recreation'],
      family: ['family', 'children', 'kids', 'all ages', 'family-friendly', 'young'],
      fundraiser: ['fundraiser', 'charity', 'benefit', 'donation', 'cause', 'nonprofit']
    };
  }

  async generateEventSummaries(events) {
    console.log(`📝 Generating summaries for ${events.length} events...`);
    
    const summarizedEvents = [];
    
    for (let i = 0; i < events.length; i++) {
      const event = { ...events[i] };
      
      try {
        console.log(`Processing event ${i + 1}/${events.length}: ${event.title}`);
        
        // Generate or improve description
        if (!event.description || event.description.length < 50) {
          const generatedDescription = this.generateDescription(event);
          if (generatedDescription) {
            event.description = generatedDescription;
            this.results.summariesGenerated++;
            console.log(`  ✅ Generated description`);
          }
        } else if (this.options.improveExistingDescriptions) {
          const improvedDescription = this.improveDescription(event.description, event);
          if (improvedDescription && improvedDescription !== event.description) {
            event.description = improvedDescription;
            this.results.descriptionsImproved++;
            console.log(`  ✨ Improved description`);
          }
        }

        // Generate short summary if requested
        if (this.options.generateShortSummary) {
          event.shortSummary = this.generateShortSummary(event);
        }

        // Add relevant keywords if needed
        if (this.options.addKeywords) {
          event.keywords = this.extractKeywords(event);
        }

        summarizedEvents.push(event);
        this.results.processed++;
        
      } catch (error) {
        console.error(`  ❌ Error processing ${event.title}:`, error.message);
        this.results.errors.push({
          event: event.title,
          error: error.message
        });
        
        // Add event without summarization
        summarizedEvents.push(event);
      }
    }
    
    // Save summarized events
    const outputPath = path.join(this.baseDir, 'data', 'merged-events', 'events-summarized.json');
    await fs.writeJson(outputPath, summarizedEvents, { spaces: 2 });
    
    console.log(`\n📊 Event summarization complete:`);
    console.log(`  • Events processed: ${this.results.processed}`);
    console.log(`  • Summaries generated: ${this.results.summariesGenerated}`);
    console.log(`  • Descriptions improved: ${this.results.descriptionsImproved}`);
    console.log(`  • Errors: ${this.results.errors.length}`);
    
    return summarizedEvents;
  }

  generateDescription(event) {
    try {
      // Start with basic info
      let description = '';
      
      // Add event type context based on title and tags
      const eventType = this.determineEventType(event);
      const typeDescriptions = {
        music: 'Join us for an exciting musical event',
        art: 'Explore creativity at this artistic gathering',
        community: 'Connect with your community at this local event',
        festival: 'Celebrate with the community at this festive occasion',
        food: 'Enjoy a delicious culinary experience',
        outdoors: 'Experience the beauty of Sandpoint\'s outdoors',
        family: 'Bring the whole family to this fun event',
        fundraiser: 'Support a great cause at this fundraising event'
      };

      description = typeDescriptions[eventType] || 'Join us for this special event';
      
      // Add venue context
      if (event.venue) {
        const venueName = typeof event.venue === 'string' ? event.venue : event.venue.name;
        if (venueName && !description.includes(venueName)) {
          description += ` at ${venueName}`;
        }
      }

      // Add date context
      if (event.date) {
        try {
          const eventDate = new Date(event.date);
          const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
          const timeStr = eventDate.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric'
          });
          
          description += ` on ${dayOfWeek}, ${timeStr}`;
          
          const hour = eventDate.getHours();
          if (hour >= 6 && hour < 12) {
            description += ' this morning';
          } else if (hour >= 12 && hour < 17) {
            description += ' this afternoon';
          } else if (hour >= 17) {
            description += ' this evening';
          }
        } catch (e) {
          // Skip date formatting if parsing fails
        }
      }

      // Add location context
      description += ' in beautiful Sandpoint, Idaho';

      // Add call to action based on event type
      const callToActions = {
        music: 'Come enjoy live music and great atmosphere.',
        art: 'Experience local creativity and artistic expression.',
        community: 'Meet your neighbors and get involved.',
        festival: 'Celebrate with food, entertainment, and fun activities.',
        food: 'Taste delicious food and discover new flavors.',
        outdoors: 'Enjoy the fresh air and scenic beauty.',
        family: 'Create lasting memories with your loved ones.',
        fundraiser: 'Help make a difference in our community.'
      };

      description += '. ' + (callToActions[eventType] || 'Don\'t miss this exciting opportunity!');

      // Add practical info
      if (event.price) {
        if (event.price.toLowerCase().includes('free') || event.price === '$0') {
          description += ' This is a free event.';
        } else {
          description += ` Tickets: ${event.price}.`;
        }
      }

      // Ensure description is not too long
      if (description.length > this.options.maxSummaryLength) {
        description = description.substring(0, this.options.maxSummaryLength - 3) + '...';
      }

      return description;

    } catch (error) {
      console.warn(`Error generating description for ${event.title}:`, error.message);
      return null;
    }
  }

  improveDescription(existingDescription, event) {
    try {
      let improved = existingDescription.trim();
      
      // Remove excessive whitespace and line breaks
      improved = improved.replace(/\s+/g, ' ').trim();
      
      // Remove common scraped artifacts
      const artifactsToRemove = [
        /^Event\s+Details?\s*:?\s*/i,
        /^Description\s*:?\s*/i,
        /Click here for more info\.?\s*/gi,
        /Read more\.?\s*$/gi,
        /\.{3,}/g,
        /\s+\.\s+/g
      ];
      
      artifactsToRemove.forEach(pattern => {
        improved = improved.replace(pattern, ' ').trim();
      });

      // Ensure it starts with a capital letter
      if (improved.length > 0) {
        improved = improved.charAt(0).toUpperCase() + improved.slice(1);
      }

      // Add location context if missing
      if (!improved.toLowerCase().includes('sandpoint') && 
          !improved.toLowerCase().includes('idaho')) {
        improved += ' Located in Sandpoint, Idaho.';
      }

      // Ensure proper ending punctuation
      if (improved.length > 0 && !improved.match(/[.!?]$/)) {
        improved += '.';
      }

      // Limit length
      if (improved.length > this.options.maxSummaryLength) {
        improved = improved.substring(0, this.options.maxSummaryLength - 3) + '...';
      }

      // Only return if actually improved
      return improved.length > existingDescription.length * 0.8 ? improved : existingDescription;

    } catch (error) {
      console.warn(`Error improving description: ${error.message}`);
      return existingDescription;
    }
  }

  generateShortSummary(event) {
    try {
      let summary = '';
      
      // Get event type
      const eventType = this.determineEventType(event);
      
      // Create concise summary
      const typeLabels = {
        music: 'Live Music',
        art: 'Art Event',
        community: 'Community Event',
        festival: 'Festival',
        food: 'Food Event',
        outdoors: 'Outdoor Activity',
        family: 'Family Event',
        fundraiser: 'Fundraiser'
      };

      summary = typeLabels[eventType] || 'Event';
      
      // Add venue if notable
      if (event.venue) {
        const venueName = typeof event.venue === 'string' ? event.venue : event.venue.name;
        const notableVenues = ['Panida Theater', 'Festival at Sandpoint', 'City Beach'];
        if (notableVenues.some(notable => venueName?.includes(notable))) {
          summary += ` at ${venueName}`;
        }
      }

      // Keep it under 50 characters
      if (summary.length > 47) {
        summary = summary.substring(0, 47) + '...';
      }

      return summary;

    } catch (error) {
      console.warn(`Error generating short summary: ${error.message}`);
      return 'Event in Sandpoint';
    }
  }

  determineEventType(event) {
    const title = (event.title || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    const tags = event.tags ? event.tags.map(tag => tag.toLowerCase()) : [];
    
    const allText = [title, description, ...tags].join(' ');
    
    // Score each category
    const scores = {};
    
    for (const [category, keywords] of Object.entries(this.eventKeywords)) {
      scores[category] = keywords.reduce((score, keyword) => {
        const occurrences = (allText.match(new RegExp(keyword, 'g')) || []).length;
        return score + occurrences;
      }, 0);
    }
    
    // Return category with highest score, or 'community' as default
    const maxCategory = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );
    
    return scores[maxCategory] > 0 ? maxCategory : 'community';
  }

  extractKeywords(event) {
    const title = (event.title || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    const venue = event.venue ? 
      (typeof event.venue === 'string' ? event.venue : event.venue.name || '') : '';
    
    const allText = `${title} ${description} ${venue}`.toLowerCase();
    const keywords = new Set();
    
    // Add event type keywords that match
    for (const [category, categoryKeywords] of Object.entries(this.eventKeywords)) {
      categoryKeywords.forEach(keyword => {
        if (allText.includes(keyword)) {
          keywords.add(keyword);
        }
      });
    }
    
    // Add location keywords
    if (allText.includes('sandpoint')) keywords.add('sandpoint');
    if (allText.includes('idaho')) keywords.add('idaho');
    if (allText.includes('downtown')) keywords.add('downtown');
    if (allText.includes('lake')) keywords.add('lake');
    
    // Add venue-specific keywords
    const venueKeywords = {
      'panida': ['theater', 'historic', 'performance'],
      'festival at sandpoint': ['outdoor', 'music', 'summer'],
      'city beach': ['lakefront', 'outdoor', 'scenic'],
      'hive': ['local', 'community', 'gathering']
    };
    
    for (const [venueKey, venueKws] of Object.entries(venueKeywords)) {
      if (allText.includes(venueKey)) {
        venueKws.forEach(kw => keywords.add(kw));
      }
    }
    
    return Array.from(keywords).slice(0, 10); // Limit to 10 keywords
  }

  // Generate event descriptions in bulk for existing events
  async enhanceExistingEvents(eventsFilePath) {
    try {
      const events = await fs.readJson(eventsFilePath);
      const enhancedEvents = await this.generateEventSummaries(events);
      
      // Save back to the same file
      await fs.writeJson(eventsFilePath, enhancedEvents, { spaces: 2 });
      
      return enhancedEvents;
    } catch (error) {
      console.error('Error enhancing existing events:', error.message);
      throw error;
    }
  }

  // Get summarization statistics
  getStats() {
    return {
      ...this.results,
      options: this.options
    };
  }
}

module.exports = EventSummarizer;