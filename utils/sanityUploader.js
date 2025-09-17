const { createClient } = require('@sanity/client');
const fs = require('fs-extra');
const path = require('path');

class SanityUploader {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.sanityConfig = {
      projectId: options.projectId || process.env.SANITY_PROJECT_ID,
      dataset: options.dataset || process.env.SANITY_DATASET || 'production',
      token: options.token || process.env.SANITY_TOKEN,
      apiVersion: options.apiVersion || '2023-05-03',
      useCdn: false // Don't use CDN for mutations
    };

    if (!this.sanityConfig.projectId || !this.sanityConfig.dataset) {
      throw new Error('Sanity project ID and dataset are required');
    }

    this.client = createClient(this.sanityConfig);
    
    this.results = {
      eventsUploaded: 0,
      venuesCreated: 0,
      eventsUpdated: 0,
      errors: [],
      duplicatesSkipped: 0
    };
  }

  async uploadEvents(events, options = {}) {
    console.log(`🚀 Uploading ${events.length} events to Sanity...`);
    
    if (!this.sanityConfig.token) {
      console.warn('⚠️  No Sanity token provided. Running in preview mode...');
      return this.previewUpload(events);
    }

    const uploadOptions = {
      skipDuplicates: options.skipDuplicates !== false,
      updateExisting: options.updateExisting !== false,
      createVenues: options.createVenues !== false,
      ...options
    };

    try {
      // First, ensure all venues exist if createVenues is enabled
      if (uploadOptions.createVenues) {
        await this.ensureVenuesExist(events);
      }

      // Process events in batches
      const batchSize = 10;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(events.length/batchSize)}...`);
        
        for (const event of batch) {
          try {
            await this.uploadSingleEvent(event, uploadOptions);
          } catch (error) {
            console.error(`  ❌ Error uploading ${event.title}:`, error.message);
            this.results.errors.push({
              event: event.title,
              error: error.message
            });
          }
        }
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('\n📊 Sanity upload complete:');
      console.log(`  • Events uploaded: ${this.results.eventsUploaded}`);
      console.log(`  • Events updated: ${this.results.eventsUpdated}`);
      console.log(`  • Venues created: ${this.results.venuesCreated}`);
      console.log(`  • Duplicates skipped: ${this.results.duplicatesSkipped}`);
      console.log(`  • Errors: ${this.results.errors.length}`);

      // Save results report
      await this.saveUploadReport();

      return this.results;

    } catch (error) {
      console.error('❌ Sanity upload failed:', error.message);
      throw error;
    }
  }

  async uploadSingleEvent(event, options) {
    try {
      // Check for existing event if skipDuplicates is enabled
      if (options.skipDuplicates) {
        const existing = await this.findExistingEvent(event);
        if (existing) {
          if (options.updateExisting) {
            await this.updateEvent(existing._id, event);
            this.results.eventsUpdated++;
            console.log(`  ✨ Updated: ${event.title}`);
          } else {
            this.results.duplicatesSkipped++;
            console.log(`  ⏭️  Skipped duplicate: ${event.title}`);
          }
          return;
        }
      }

      // Create new event document
      const eventDoc = await this.transformEventForSanity(event);
      const result = await this.client.create(eventDoc);
      
      this.results.eventsUploaded++;
      console.log(`  ✅ Uploaded: ${event.title}`);
      
      return result;

    } catch (error) {
      console.error(`Error uploading event ${event.title}:`, error.message);
      throw error;
    }
  }

  async transformEventForSanity(event) {
    const sanityEvent = {
      _type: 'event',
      title: event.title,
      slug: {
        _type: 'slug',
        current: event.slug
      },
      // Handle both legacy and new date fields
      date: event.date || event.startDate,
      startDate: event.startDate || event.date,
      endDate: event.endDate || null,
      startTime: event.startTime || null,
      endTime: event.endTime || null,
      description: event.description || '',
      tags: event.tags || [],
      url: event.url || null,
      tickets: event.tickets || event.ticketUrl || null,
      referenceUrl: event.referenceUrl || event.url || null,
      needsReview: event.needsReview || false,
      locationNote: event.locationNote || null,
      // Add source information
      source: event.source || 'Unknown',
      scrapedAt: event.scraped_at || event.scrapedAt || new Date().toISOString(),
      // Default to published unless flagged for review
      published: !(event.needsReview || false)
    };

    // Handle images - check both 'image' and 'imageUrl' fields
    const imageSource = event.imageUrl || event.image;
    if (imageSource) {
      try {
        let imageAsset = null;
        
        // If it's a local image path, upload it to Sanity
        if (imageSource.startsWith('/images/')) {
          const imagePath = path.join(this.baseDir, 'public', imageSource);
          if (await fs.pathExists(imagePath)) {
            imageAsset = await this.uploadImageToSanity(imagePath, event.title);
          }
        } 
        // If it's an external URL, download and upload to Sanity
        else if (imageSource.startsWith('http')) {
          imageAsset = await this.downloadAndUploadImageToSanity(imageSource, event.title);
        }

        if (imageAsset) {
          sanityEvent.image = {
            _type: 'image',
            asset: {
              _type: 'reference',
              _ref: imageAsset._id
            }
          };
          // Event has image - ensure it stays published (unless flagged for review)
          if (!event.needsReview) {
            sanityEvent.published = true;
          }
        }
      } catch (error) {
        console.warn(`  ⚠️  Could not upload image for ${event.title}:`, error.message);
      }
    }

    // Handle venue
    if (event.venue) {
      const venueRef = await this.getOrCreateVenueReference(event.venue);
      if (venueRef) {
        sanityEvent.venue = {
          _type: 'reference',
          _ref: venueRef._id
        };
      }
    }

    return sanityEvent;
  }

  async findExistingEvent(event) {
    try {
      // Search by title and date
      const query = `*[_type == "event" && title == $title && date == $date][0]`;
      const result = await this.client.fetch(query, {
        title: event.title,
        date: event.date
      });
      
      return result;
    } catch (error) {
      console.warn(`Error checking for existing event: ${error.message}`);
      return null;
    }
  }

  async updateEvent(eventId, newEventData) {
    try {
      const updateDoc = await this.transformEventForSanity(newEventData);
      delete updateDoc._type; // Remove _type for updates
      
      const result = await this.client.patch(eventId).set(updateDoc).commit();
      return result;
    } catch (error) {
      console.error(`Error updating event ${eventId}:`, error.message);
      throw error;
    }
  }

  async ensureVenuesExist(events) {
    console.log('🏢 Ensuring venues exist in Sanity...');
    
    const uniqueVenues = new Map();
    
    // Collect unique venues
    events.forEach(event => {
      if (event.venue) {
        const venueKey = typeof event.venue === 'string' ? 
          event.venue : 
          event.venue.name || 'Unknown Venue';
        
        if (!uniqueVenues.has(venueKey)) {
          uniqueVenues.set(venueKey, event.venue);
        }
      }
    });

    console.log(`  Found ${uniqueVenues.size} unique venues to check/create`);

    // Check/create each venue
    for (const [venueName, venueData] of uniqueVenues) {
      try {
        await this.getOrCreateVenueReference(venueData, true);
      } catch (error) {
        console.warn(`  ⚠️  Could not create venue ${venueName}:`, error.message);
      }
    }
  }

  async getOrCreateVenueReference(venueData, forceCreate = false) {
    if (!venueData) return null;
    
    const venueName = typeof venueData === 'string' ? venueData : venueData.name;
    if (!venueName) return null;

    try {
      // Check if venue already exists
      const query = `*[_type == "venue" && name == $name][0]`;
      let venue = await this.client.fetch(query, { name: venueName });
      
      if (!venue && forceCreate) {
        // Create new venue
        const venueDoc = {
          _type: 'venue',
          name: venueName,
          slug: {
            _type: 'slug',
            current: this.generateSlug(venueName)
          }
        };

        // Add additional venue data if available
        if (typeof venueData === 'object') {
          if (venueData.address) venueDoc.address = venueData.address;
          if (venueData.city) venueDoc.city = venueData.city;
          if (venueData.state) venueDoc.state = venueData.state;
          if (venueData.zipCode) venueDoc.zipCode = venueData.zipCode;
          if (venueData.phone) venueDoc.phone = venueData.phone;
          if (venueData.website) venueDoc.website = venueData.website;
        }

        venue = await this.client.create(venueDoc);
        this.results.venuesCreated++;
        console.log(`  🏢 Created venue: ${venueName}`);
      }

      return venue;
    } catch (error) {
      console.warn(`Error handling venue ${venueName}:`, error.message);
      return null;
    }
  }

  async uploadImageToSanity(imagePath, altText = '') {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const filename = path.basename(imagePath);
      
      const asset = await this.client.assets.upload('image', imageBuffer, {
        filename,
        title: altText
      });
      
      return asset;
    } catch (error) {
      console.error(`Error uploading image ${imagePath}:`, error.message);
      return null;
    }
  }

  async downloadAndUploadImageToSanity(imageUrl, altText = '') {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(imageUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        console.log(`    📥 Downloading image: ${imageUrl}`);
        
        const request = protocol.get(imageUrl, (response) => {
          if (response.statusCode !== 200) {
            console.warn(`    ⚠️  Image download failed with status: ${response.statusCode}`);
            resolve(null);
            return;
          }
          
          // Get file extension from URL or content-type
          let extension = path.extname(parsedUrl.pathname).toLowerCase();
          if (!extension && response.headers['content-type']) {
            const contentType = response.headers['content-type'];
            if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = '.jpg';
            else if (contentType.includes('png')) extension = '.png';
            else if (contentType.includes('webp')) extension = '.webp';
            else if (contentType.includes('gif')) extension = '.gif';
          }
          
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          
          response.on('end', async () => {
            try {
              const imageBuffer = Buffer.concat(chunks);
              const filename = `event-image-${Date.now()}${extension || '.jpg'}`;
              
              console.log(`    📤 Uploading to Sanity: ${filename}`);
              
              const asset = await this.client.assets.upload('image', imageBuffer, {
                filename,
                title: altText || 'Event Image'
              });
              
              console.log(`    ✅ Image uploaded successfully: ${asset._id}`);
              resolve(asset);
            } catch (uploadError) {
              console.error(`    ❌ Error uploading image to Sanity:`, uploadError.message);
              resolve(null);
            }
          });
        });
        
        request.on('error', (error) => {
          console.warn(`    ⚠️  Error downloading image ${imageUrl}:`, error.message);
          resolve(null);
        });
        
        // Set timeout for download
        request.setTimeout(30000, () => {
          console.warn(`    ⚠️  Image download timeout: ${imageUrl}`);
          request.destroy();
          resolve(null);
        });
        
      } catch (error) {
        console.warn(`    ⚠️  Invalid image URL ${imageUrl}:`, error.message);
        resolve(null);
      }
    });
  }

  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-')
      .substring(0, 96); // Sanity slug limit
  }

  async previewUpload(events) {
    console.log('\n🔍 PREVIEW MODE - No actual upload performed');
    console.log('=====================================');
    
    const preview = {
      totalEvents: events.length,
      sampleEvents: events.slice(0, 3).map(event => ({
        title: event.title,
        date: event.date,
        venue: typeof event.venue === 'string' ? event.venue : event.venue?.name,
        hasImage: !!(event.image || event.imageUrl),
        willBePublished: !!(event.image || event.imageUrl),
        tags: event.tags?.length || 0
      })),
      uniqueVenues: [...new Set(events.map(e => 
        typeof e.venue === 'string' ? e.venue : e.venue?.name
      ).filter(Boolean))],
      dateRange: {
        earliest: events.reduce((min, e) => 
          !min || new Date(e.date) < new Date(min) ? e.date : min, null),
        latest: events.reduce((max, e) => 
          !max || new Date(e.date) > new Date(max) ? e.date : max, null)
      }
    };

    console.log(`📊 Events to upload: ${preview.totalEvents}`);
    console.log(`🏢 Unique venues: ${preview.uniqueVenues.length}`);
    console.log(`📅 Date range: ${preview.dateRange.earliest} to ${preview.dateRange.latest}`);
    
    console.log('\n📋 Sample events:');
    preview.sampleEvents.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.title}`);
      console.log(`     Date: ${event.date}`);
      console.log(`     Venue: ${event.venue || 'None'}`);
      console.log(`     Image: ${event.hasImage ? 'Yes' : 'No'}`);
      console.log(`     Will be published: ${event.willBePublished ? 'Yes' : 'No (draft)'}`);
      console.log(`     Tags: ${event.tags}`);
    });

    console.log('\n🏢 Venues found:');
    preview.uniqueVenues.slice(0, 10).forEach(venue => {
      console.log(`  • ${venue}`);
    });
    if (preview.uniqueVenues.length > 10) {
      console.log(`  ... and ${preview.uniqueVenues.length - 10} more`);
    }

    console.log('\n💡 To perform actual upload:');
    console.log('   1. Set SANITY_TOKEN environment variable');
    console.log('   2. Verify SANITY_PROJECT_ID and SANITY_DATASET');
    console.log('   3. Run the upload again');

    return preview;
  }

  async saveUploadReport() {
    const report = {
      timestamp: new Date().toISOString(),
      sanity_config: {
        projectId: this.sanityConfig.projectId,
        dataset: this.sanityConfig.dataset,
        hasToken: !!this.sanityConfig.token
      },
      results: this.results
    };

    const reportPath = path.join(this.baseDir, 'data', 'sanity-upload-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`📋 Upload report saved to ${reportPath}`);
  }

  // Load events from the merged events file and upload
  async uploadMergedEvents(options = {}) {
    const eventsPath = path.join(this.baseDir, 'data', 'merged-events', 'events.json');
    
    if (!(await fs.pathExists(eventsPath))) {
      throw new Error('No merged events found. Run the scraping pipeline first.');
    }

    const events = await fs.readJson(eventsPath);
    return this.uploadEvents(events, options);
  }

  // Get upload statistics
  getStats() {
    return {
      ...this.results,
      sanityConfig: {
        projectId: this.sanityConfig.projectId,
        dataset: this.sanityConfig.dataset,
        hasToken: !!this.sanityConfig.token
      }
    };
  }

  // Fetch all existing events from Sanity
  async getAllEventsFromSanity() {
    try {
      const events = await this.client.fetch('*[_type == "event"] | order(date asc)');
      console.log(`📋 Found ${events.length} existing events in Sanity`);
      return events;
    } catch (error) {
      console.error('Error fetching events from Sanity:', error.message);
      throw error;
    }
  }

  // Update all existing events with enhanced data (URLs, images, etc.)
  async enhanceAllExistingEvents(options = {}) {
    console.log('🚀 Starting comprehensive event enhancement...');
    
    if (!this.sanityConfig.token) {
      throw new Error('Sanity token required for event enhancement');
    }

    try {
      // Get all existing events from Sanity
      const existingEvents = await this.getAllEventsFromSanity();
      
      // Enhanced events with URLs and images
      let enhancedEventsPath = path.join(this.baseDir, 'data', 'merged-events', 'real-enhanced-events.json');
      let enhancedEvents = [];
      
      // Try real enhanced events first, fallback to original
      if (options.useRealEnhancedEvents && await fs.pathExists(enhancedEventsPath)) {
        enhancedEvents = await fs.readJson(enhancedEventsPath);
        console.log(`📊 Found ${enhancedEvents.length} real enhanced events with local images`);
      } else {
        enhancedEventsPath = path.join(this.baseDir, 'data', 'merged-events', 'events-enhanced-with-urls.json');
        if (await fs.pathExists(enhancedEventsPath)) {
          enhancedEvents = await fs.readJson(enhancedEventsPath);
          console.log(`📊 Found ${enhancedEvents.length} pre-enhanced events with URLs/images`);
        }
      }

      // Create enhancement mapping
      const enhancementMap = new Map();
      enhancedEvents.forEach(event => {
        // Try multiple matching strategies
        const keys = [
          event.slug,
          this.generateSlug(event.title),
          event.title.toLowerCase()
        ];
        keys.forEach(key => {
          if (key) enhancementMap.set(key, event);
        });
      });

      console.log(`🔄 Enhancing ${existingEvents.length} existing events...`);
      
      const results = {
        enhanced: 0,
        imagesAdded: 0,
        urlsAdded: 0,
        errors: []
      };

      // Process each existing event
      for (const existingEvent of existingEvents) {
        try {
          console.log(`\n🔧 Processing: ${existingEvent.title}`);
          
          // Find enhancement data
          let enhancementData = null;
          const searchKeys = [
            existingEvent.slug?.current,
            this.generateSlug(existingEvent.title),
            existingEvent.title.toLowerCase()
          ];
          
          for (const key of searchKeys) {
            if (key && enhancementMap.has(key)) {
              enhancementData = enhancementMap.get(key);
              console.log(`  📍 Found enhancement data via key: ${key}`);
              break;
            }
          }

          // If no direct match, try fuzzy matching
          if (!enhancementData) {
            enhancementData = this.findBestMatch(existingEvent, enhancedEvents);
            if (enhancementData) {
              console.log(`  🎯 Found enhancement via fuzzy matching`);
            }
          }

          // Apply enhancements
          const updates = {};
          let hasUpdates = false;

          // Add URL if available and not already present
          if (enhancementData && enhancementData.url && !existingEvent.url) {
            updates.url = enhancementData.url;
            hasUpdates = true;
            results.urlsAdded++;
            console.log(`  🔗 Adding URL: ${enhancementData.url}`);
          }

          // Add ticket URL if available
          if (enhancementData && (enhancementData.ticketUrl || enhancementData.tickets) && !existingEvent.tickets) {
            updates.tickets = enhancementData.ticketUrl || enhancementData.tickets;
            hasUpdates = true;
            console.log(`  🎫 Adding ticket URL`);
          }

          // Add/update image if available and not already present
          if (enhancementData && enhancementData.imageUrl && !existingEvent.image) {
            console.log(`  🖼️  Processing image: ${enhancementData.imageUrl}`);
            try {
              const imageAsset = await this.downloadAndUploadImageToSanity(
                enhancementData.imageUrl, 
                existingEvent.title
              );
              
              if (imageAsset) {
                updates.image = {
                  _type: 'image',
                  asset: {
                    _type: 'reference',
                    _ref: imageAsset._id
                  }
                };
                // Event now has image, mark as published
                updates.published = true;
                hasUpdates = true;
                results.imagesAdded++;
                console.log(`  ✅ Image uploaded and added - event marked as published`);
              }
            } catch (imageError) {
              console.warn(`  ⚠️  Image upload failed: ${imageError.message}`);
            }
          }

          // Add other missing data
          if (enhancementData) {
            if (enhancementData.description && (!existingEvent.description || existingEvent.description.length < 50)) {
              updates.description = enhancementData.description;
              hasUpdates = true;
            }
            
            if (enhancementData.tags && enhancementData.tags.length > 0 && (!existingEvent.tags || existingEvent.tags.length === 0)) {
              updates.tags = enhancementData.tags;
              hasUpdates = true;
            }

            if (enhancementData.price && !existingEvent.price) {
              updates.price = enhancementData.price;
              hasUpdates = true;
            }
          }

          // Apply updates if any
          if (hasUpdates) {
            await this.client.patch(existingEvent._id).set(updates).commit();
            results.enhanced++;
            console.log(`  ✨ Event enhanced successfully`);
          } else {
            console.log(`  ⏭️  No enhancements needed`);
          }

        } catch (error) {
          console.error(`  ❌ Error enhancing ${existingEvent.title}:`, error.message);
          results.errors.push({
            event: existingEvent.title,
            error: error.message
          });
        }
      }

      console.log('\n📊 Enhancement Summary:');
      console.log(`  • Events enhanced: ${results.enhanced}`);
      console.log(`  • Images added: ${results.imagesAdded}`);
      console.log(`  • URLs added: ${results.urlsAdded}`);
      console.log(`  • Errors: ${results.errors.length}`);

      return results;

    } catch (error) {
      console.error('❌ Event enhancement failed:', error.message);
      throw error;
    }
  }

  // Helper method for fuzzy matching events
  findBestMatch(existingEvent, enhancedEvents) {
    const existingTitle = existingEvent.title.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const enhanced of enhancedEvents) {
      const enhancedTitle = enhanced.title.toLowerCase();
      
      // Simple similarity check
      const score = this.calculateSimilarity(existingTitle, enhancedTitle);
      
      if (score > 0.8 && score > bestScore) {
        bestScore = score;
        bestMatch = enhanced;
      }
    }

    return bestMatch;
  }

  // Simple string similarity calculation
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Levenshtein distance calculation
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = SanityUploader;