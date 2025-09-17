const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { createHash } = require('crypto');
// const sharp = require('sharp'); // Optional dependency

class RealImageDownloader {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.imageDir = path.join(this.baseDir, 'public', 'images', 'eventimages');
    this.options = {
      downloadTimeout: options.downloadTimeout || 30000,
      maxImageSize: options.maxImageSize || 5 * 1024 * 1024, // 5MB
      minImageSize: options.minImageSize || 1024, // 1KB minimum
      allowedFormats: options.allowedFormats || ['jpg', 'jpeg', 'png', 'webp'],
      retryAttempts: options.retryAttempts || 3,
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ...options
    };
    
    // Ensure directories exist
    fs.ensureDirSync(this.imageDir);
    
    this.stats = {
      processed: 0,
      downloaded: 0,
      failed: 0,
      skipped: 0,
      needsReview: 0,
      preservedReviewFlags: 0,
      errors: [],
      reviewReasons: []
    };
    
    // Popular venue image search queries
    this.venueImageQueries = {
      'Panida Theater': 'Panida Theater Sandpoint Idaho historic theater',
      'Schweitzer Mountain Resort': 'Schweitzer Mountain Resort Idaho ski lodge',
      'Downtown Sandpoint': 'Downtown Sandpoint Idaho Main Street',
      'Festival at Sandpoint': 'Festival at Sandpoint Idaho music outdoor',
      'The Hive': 'The Hive Sandpoint Idaho venue',
      'MickDuff\'s Beer Hall': 'MickDuffs Beer Hall Sandpoint Idaho pub',
      'City Beach Park': 'Sandpoint City Beach Park Idaho waterfront',
      'Bonner County Fairgrounds': 'Bonner County Fairgrounds Sandpoint Idaho'
    };
  }

  async downloadRealImagesForEvents(events) {
    console.log(`🖼️  Starting real image download for ${events.length} events`);
    console.log('================================================================\n');

    const processedEvents = [];

    for (let i = 0; i < events.length; i++) {
      const event = { ...events[i] };
      this.stats.processed++;
      
      // Track if event already had needsReview flag from scraper
      const hadExistingReviewFlag = event.needsReview === true;
      if (hadExistingReviewFlag) {
        this.stats.preservedReviewFlags++;
        console.log(`Processing ${i + 1}/${events.length}: ${event.title} (already flagged for review)`);
      } else {
        console.log(`Processing ${i + 1}/${events.length}: ${event.title}`);
      }

      try {
        // First try to download from existing imageUrl
        let downloadedPath = null;
        let imageFailureReason = null;
        
        if (event.imageUrl && event.imageUrl.startsWith('http')) {
          const result = await this.downloadImageFromUrl(event.imageUrl, event);
          downloadedPath = result.path;
          imageFailureReason = result.error;
        }

        // If no existing imageUrl or download failed, search for venue-specific image
        if (!downloadedPath && event.venue && event.venue.name) {
          const result = await this.downloadVenueImage(event.venue.name, event);
          downloadedPath = result.path;
          if (!imageFailureReason && result.error) {
            imageFailureReason = result.error;
          }
        }

        // If still no image, try generic event type search
        if (!downloadedPath) {
          const result = await this.downloadEventTypeImage(event);
          downloadedPath = result.path;
          if (!imageFailureReason && result.error) {
            imageFailureReason = result.error;
          }
        }

        if (downloadedPath) {
          event.imageUrl = downloadedPath;
          console.log(`   ✅ Image downloaded: ${downloadedPath}`);
          this.stats.downloaded++;
        } else {
          // Set needsReview flag if image could not be obtained and wasn't already flagged
          if (!hadExistingReviewFlag) {
            event.needsReview = true;
            this.stats.needsReview++;
            const reason = imageFailureReason || 'No suitable image found';
            this.stats.reviewReasons.push({
              event: event.title,
              reason: `Image issue: ${reason}`
            });
            console.log(`   ⚠️  No image found - flagged for review: ${reason}`);
          } else {
            console.log(`   ⚠️  No image found (already flagged for review)`);
          }
          this.stats.skipped++;
        }

        processedEvents.push(event);

      } catch (error) {
        console.error(`   ❌ Error processing ${event.title}:`, error.message);
        
        // Set needsReview flag for processing errors if not already set
        if (!hadExistingReviewFlag) {
          event.needsReview = true;
          this.stats.needsReview++;
          this.stats.reviewReasons.push({
            event: event.title,
            reason: `Processing error: ${error.message}`
          });
        }
        
        this.stats.failed++;
        this.stats.errors.push({
          event: event.title,
          error: error.message
        });
        processedEvents.push(event); // Add event with needsReview flag
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMAGE DOWNLOAD SUMMARY');
    console.log('='.repeat(60));
    console.log(`Events processed: ${this.stats.processed}`);
    console.log(`Images downloaded: ${this.stats.downloaded}`);
    console.log(`Download failures: ${this.stats.failed}`);
    console.log(`Events skipped: ${this.stats.skipped}`);
    console.log(`Events flagged for review: ${this.stats.needsReview}`);
    console.log(`Events with existing review flags: ${this.stats.preservedReviewFlags}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\nErrors encountered: ${this.stats.errors.length}`);
      this.stats.errors.forEach(error => {
        console.log(`  • ${error.event}: ${error.error}`);
      });
    }
    
    if (this.stats.reviewReasons.length > 0) {
      console.log(`\nReview reasons (newly flagged events): ${this.stats.reviewReasons.length}`);
      this.stats.reviewReasons.forEach(reason => {
        console.log(`  • ${reason.event}: ${reason.reason}`);
      });
    }

    console.log('\n✅ Image downloading complete!');
    console.log('='.repeat(60) + '\n');

    return processedEvents;
  }

  async downloadImageFromUrl(imageUrl, event) {
    console.log(`   🔍 Trying to download from: ${imageUrl.substring(0, 80)}...`);

    try {
      // Validate URL first
      if (!this.isValidImageUrl(imageUrl)) {
        const error = 'Invalid image URL format';
        console.log(`   ⚠️  ${error}`);
        return { path: null, error };
      }

      const response = await this.fetchImageWithRetry(imageUrl);
      if (!response) {
        const error = 'Failed to fetch image after retries';
        return { path: null, error };
      }

      // Generate filename based on event slug and content hash
      const imageBuffer = await this.streamToBuffer(response.data);
      const contentHash = createHash('md5').update(imageBuffer).digest('hex').substring(0, 8);
      const extension = this.getFileExtensionFromResponse(response, imageUrl);
      const filename = `${event.slug || 'event'}-${contentHash}.${extension}`;
      const filepath = path.join(this.imageDir, filename);

      // Save and optimize image
      await this.saveAndOptimizeImage(imageBuffer, filepath);
      
      return { path: `/images/eventimages/${filename}`, error: null };

    } catch (error) {
      console.log(`   ⚠️  Failed to download from URL: ${error.message}`);
      return { path: null, error: error.message };
    }
  }

  async downloadVenueImage(venueName, event) {
    console.log(`   🏢 Searching for venue image: ${venueName}`);

    const searchQuery = this.venueImageQueries[venueName] || `${venueName} Sandpoint Idaho venue`;
    
    try {
      // In a real implementation, you would use an image search API
      // For now, we'll simulate with some example venue images
      const venueImageMap = {
        'Panida Theater': 'https://www.panida.org/wp-content/uploads/theater-exterior.jpg',
        'Schweitzer Mountain Resort': 'https://www.schweitzer.com/images/resort-summer-view.jpg', 
        'Downtown Sandpoint': 'https://www.cityofsandpoint.com/images/downtown-main-street.jpg',
        'The Hive': 'https://www.hivesandpoint.com/images/venue-interior.jpg',
        'City Beach Park': 'https://www.cityofsandpoint.com/images/city-beach-park.jpg'
      };

      const imageUrl = venueImageMap[venueName];
      if (imageUrl) {
        console.log(`   📍 Found venue image URL: ${imageUrl.substring(0, 60)}...`);
        return await this.downloadImageFromUrl(imageUrl, event);
      }

      const error = `No specific venue image found for ${venueName}`;
      console.log(`   ⚠️  ${error}`);
      return { path: null, error };

    } catch (error) {
      console.log(`   ❌ Venue image search failed: ${error.message}`);
      return { path: null, error: error.message };
    }
  }

  async downloadEventTypeImage(event) {
    console.log(`   🎨 Searching for event type image based on tags`);

    try {
      // Map event tags to stock image URLs
      const eventTypeImages = {
        'music': 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80',
        'theater': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
        'art': 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80',
        'festival': 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80',
        'outdoor': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
        'community': 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80',
        'food': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
        'market': 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80'
      };

      if (event.tags && Array.isArray(event.tags)) {
        for (const tag of event.tags) {
          const normalizedTag = tag.toLowerCase();
          if (eventTypeImages[normalizedTag]) {
            console.log(`   🏷️  Found image for tag "${tag}"`);
            return await this.downloadImageFromUrl(eventTypeImages[normalizedTag], event);
          }
        }
      }

      // DO NOT use generic fallback images - this would be fabricating data
      // Instead, return no image found so the event gets flagged for review
      const error = 'No matching tag-based image found and no generic fallback used';
      console.log(`   ⚠️  ${error}`);
      return { path: null, error };

    } catch (error) {
      console.log(`   ❌ Event type image search failed: ${error.message}`);
      return { path: null, error: error.message };
    }
  }

  async fetchImageWithRetry(imageUrl) {
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        console.log(`   📥 Download attempt ${attempt}/${this.options.retryAttempts}`);
        
        const response = await axios.get(imageUrl, {
          responseType: 'stream',
          timeout: this.options.downloadTimeout,
          headers: {
            'User-Agent': this.options.userAgent,
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
          },
          maxRedirects: 5
        });

        // Validate response
        if (!this.isValidImageResponse(response)) {
          throw new Error(`Invalid image response: ${response.headers['content-type']}`);
        }

        return response;

      } catch (error) {
        console.log(`   ⚠️  Attempt ${attempt} failed: ${error.message}`);
        if (attempt === this.options.retryAttempts) {
          throw error;
        }
        
        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }
  }

  async streamToBuffer(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async saveAndOptimizeImage(imageBuffer, filepath) {
    try {
      // Check image size
      if (imageBuffer.length < this.options.minImageSize) {
        throw new Error(`Image too small: ${imageBuffer.length} bytes`);
      }
      
      if (imageBuffer.length > this.options.maxImageSize) {
        console.log(`   📏 Large image detected (${imageBuffer.length} bytes)`);
      }

      // For now, save as-is without optimization
      // In production, you could add sharp for image optimization
      await fs.writeFile(filepath, imageBuffer);
      
      console.log(`   💾 Saved image (${imageBuffer.length} bytes)`);

    } catch (error) {
      throw new Error(`Failed to save image: ${error.message}`);
    }
  }

  isValidImageUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  isValidImageResponse(response) {
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      return false;
    }

    const contentLength = parseInt(response.headers['content-length'] || '0');
    if (contentLength > 0 && contentLength < this.options.minImageSize) {
      return false;
    }

    return true;
  }

  getFileExtensionFromResponse(response, fallbackUrl) {
    // Get extension from content type
    const contentType = response.headers['content-type'];
    const typeMap = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg', 
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };

    if (typeMap[contentType]) {
      return typeMap[contentType];
    }

    // Fallback to URL extension
    try {
      const urlPath = new URL(fallbackUrl).pathname;
      const extension = path.extname(urlPath).substring(1).toLowerCase();
      if (this.options.allowedFormats.includes(extension)) {
        return extension;
      }
    } catch {
      // Ignore URL parsing errors
    }

    return 'jpg'; // Default fallback
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      ...this.stats,
      imageDirectory: this.imageDir,
      summary: {
        totalProcessed: this.stats.processed,
        successfulDownloads: this.stats.downloaded,
        newlyFlaggedForReview: this.stats.needsReview,
        preservedReviewFlags: this.stats.preservedReviewFlags,
        failureRate: this.stats.processed > 0 ? (this.stats.failed / this.stats.processed * 100).toFixed(1) + '%' : '0%',
        reviewRate: this.stats.processed > 0 ? ((this.stats.needsReview + this.stats.preservedReviewFlags) / this.stats.processed * 100).toFixed(1) + '%' : '0%'
      }
    };
  }
}

module.exports = RealImageDownloader;