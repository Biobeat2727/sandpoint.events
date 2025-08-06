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
      date: event.date,
      description: event.description || '',
      tags: event.tags || [],
      url: event.url || null,
      tickets: event.tickets || null,
      // Add source information
      source: event.source || 'Unknown',
      scrapedAt: event.scraped_at || new Date().toISOString()
    };

    // Handle image
    if (event.image) {
      // If it's a local image path, upload it to Sanity
      if (event.image.startsWith('/images/')) {
        try {
          const imagePath = path.join(this.baseDir, 'public', event.image);
          if (await fs.pathExists(imagePath)) {
            const imageAsset = await this.uploadImageToSanity(imagePath, event.title);
            if (imageAsset) {
              sanityEvent.image = {
                _type: 'image',
                asset: {
                  _type: 'reference',
                  _ref: imageAsset._id
                }
              };
            }
          }
        } catch (error) {
          console.warn(`  ⚠️  Could not upload image for ${event.title}:`, error.message);
        }
      } else {
        // Store external URL as a simple string for now
        // In production, you might want to download and upload external images
        sanityEvent.imageUrl = event.image;
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
        hasImage: !!event.image,
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
}

module.exports = SanityUploader;