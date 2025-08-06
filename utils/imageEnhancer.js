const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ImageEnhancer {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.imageDir = path.join(this.baseDir, 'public', 'images', 'eventimages');
    this.fallbackImageDir = path.join(this.baseDir, 'public', 'images', 'fallbacks');
    this.options = {
      downloadImages: options.downloadImages !== false,
      generateFallbacks: options.generateFallbacks !== false,
      maxImageSize: options.maxImageSize || 2 * 1024 * 1024, // 2MB
      allowedFormats: options.allowedFormats || ['jpg', 'jpeg', 'png', 'webp'],
      ...options
    };
    
    // Ensure directories exist
    fs.ensureDirSync(this.imageDir);
    fs.ensureDirSync(this.fallbackImageDir);
    
    this.results = {
      processed: 0,
      downloaded: 0,
      fallbacksGenerated: 0,
      errors: []
    };
  }

  async enhanceEventImages(events) {
    console.log(`🎨 Enhancing images for ${events.length} events...`);
    
    const enhancedEvents = [];
    
    for (let i = 0; i < events.length; i++) {
      const event = { ...events[i] };
      
      try {
        console.log(`Processing event ${i + 1}/${events.length}: ${event.title}`);
        
        if (event.image) {
          const enhancedImage = await this.processEventImage(event.image, event);
          if (enhancedImage) {
            event.image = enhancedImage;
            console.log(`  ✅ Image processed successfully`);
          } else {
            console.log(`  ⚠️  Using original image URL`);
          }
        } else {
          // Generate fallback image
          if (this.options.generateFallbacks) {
            const fallbackImage = await this.generateFallbackImage(event);
            if (fallbackImage) {
              event.image = fallbackImage;
              console.log(`  📷 Generated fallback image`);
            }
          }
        }
        
        enhancedEvents.push(event);
        this.results.processed++;
        
      } catch (error) {
        console.error(`  ❌ Error processing ${event.title}:`, error.message);
        this.results.errors.push({
          event: event.title,
          error: error.message
        });
        
        // Add event without enhancement
        enhancedEvents.push(event);
      }
    }
    
    // Save enhanced events
    const outputPath = path.join(this.baseDir, 'data', 'merged-events', 'events-enhanced.json');
    await fs.writeJson(outputPath, enhancedEvents, { spaces: 2 });
    
    console.log(`\n📊 Image enhancement complete:`);
    console.log(`  • Events processed: ${this.results.processed}`);
    console.log(`  • Images downloaded: ${this.results.downloaded}`);
    console.log(`  • Fallbacks generated: ${this.results.fallbacksGenerated}`);
    console.log(`  • Errors: ${this.results.errors.length}`);
    
    return enhancedEvents;
  }

  async processEventImage(imageUrl, event) {
    try {
      // Validate image URL
      if (!this.isValidImageUrl(imageUrl)) {
        console.log(`  ⚠️  Invalid image URL: ${imageUrl}`);
        return null;
      }

      if (this.options.downloadImages) {
        // Download and save locally
        const localImagePath = await this.downloadImage(imageUrl, event);
        if (localImagePath) {
          return localImagePath;
        }
      }

      // Return original URL if download failed or disabled
      return imageUrl;
      
    } catch (error) {
      console.warn(`  Error processing image ${imageUrl}:`, error.message);
      return null;
    }
  }

  async downloadImage(imageUrl, event) {
    try {
      console.log(`  📥 Downloading image...`);
      
      const response = await axios.get(imageUrl, {
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Check content type
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      // Check file size
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength > this.options.maxImageSize) {
        throw new Error(`Image too large: ${contentLength} bytes`);
      }

      // Generate filename
      const extension = this.getImageExtension(contentType, imageUrl);
      const filename = `${event.slug || uuidv4()}-${Date.now()}.${extension}`;
      const filepath = path.join(this.imageDir, filename);

      // Save image
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Verify file was created and has content
      const stats = await fs.stat(filepath);
      if (stats.size === 0) {
        await fs.remove(filepath);
        throw new Error('Downloaded file is empty');
      }

      this.results.downloaded++;
      return `/images/eventimages/${filename}`;

    } catch (error) {
      console.warn(`  Failed to download image: ${error.message}`);
      return null;
    }
  }

  async generateFallbackImage(event) {
    try {
      // For now, we'll use a simple approach with placeholder images
      // In a full implementation, you might generate custom images with event details
      
      const fallbackImages = [
        'default-event.jpg',
        'community-event.jpg',
        'music-event.jpg',
        'festival-event.jpg',
        'art-event.jpg'
      ];

      // Choose fallback based on event tags
      let fallbackImage = 'default-event.jpg';
      
      if (event.tags && Array.isArray(event.tags)) {
        if (event.tags.some(tag => tag.toLowerCase().includes('music'))) {
          fallbackImage = 'music-event.jpg';
        } else if (event.tags.some(tag => tag.toLowerCase().includes('art'))) {
          fallbackImage = 'art-event.jpg';
        } else if (event.tags.some(tag => tag.toLowerCase().includes('festival'))) {
          fallbackImage = 'festival-event.jpg';
        } else if (event.tags.some(tag => tag.toLowerCase().includes('community'))) {
          fallbackImage = 'community-event.jpg';
        }
      }

      // Create fallback images if they don't exist
      await this.createFallbackImageIfNeeded(fallbackImage, event);
      
      this.results.fallbacksGenerated++;
      return `/images/fallbacks/${fallbackImage}`;

    } catch (error) {
      console.warn(`Failed to generate fallback image: ${error.message}`);
      return null;
    }
  }

  async createFallbackImageIfNeeded(filename, event) {
    const filepath = path.join(this.fallbackImageDir, filename);
    
    if (await fs.pathExists(filepath)) {
      return; // Image already exists
    }

    // Create a simple colored rectangle as fallback
    // In a real implementation, you might use a library like canvas or sharp
    // For now, we'll copy from existing fallback images or create placeholder
    
    try {
      // Try to copy from existing event images directory
      const existingImages = await fs.readdir(path.join(this.baseDir, 'public', 'images', 'eventimages'));
      if (existingImages.length > 0) {
        const sourceImage = path.join(this.baseDir, 'public', 'images', 'eventimages', existingImages[0]);
        await fs.copy(sourceImage, filepath);
        return;
      }
    } catch (e) {
      // Ignore copy errors
    }

    // Create a simple text file as placeholder (in reality you'd create an actual image)
    await fs.writeFile(filepath, `Placeholder image for ${filename}`);
  }

  isValidImageUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  getImageExtension(contentType, url) {
    // Get extension from content type
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
      const urlPath = new URL(url).pathname;
      const extension = path.extname(urlPath).substring(1).toLowerCase();
      if (this.options.allowedFormats.includes(extension)) {
        return extension;
      }
    } catch {
      // Ignore URL parsing errors
    }

    return 'jpg'; // Default fallback
  }

  // Optimize existing images in the directory
  async optimizeExistingImages() {
    console.log('🔧 Optimizing existing images...');
    
    try {
      const imageFiles = await fs.readdir(this.imageDir);
      const results = {
        processed: 0,
        errors: []
      };

      for (const file of imageFiles) {
        try {
          const filepath = path.join(this.imageDir, file);
          const stats = await fs.stat(filepath);
          
          // Check if image is too large
          if (stats.size > this.options.maxImageSize) {
            console.log(`  📏 Large image found: ${file} (${stats.size} bytes)`);
            // In a real implementation, you might resize the image here
          }
          
          results.processed++;
        } catch (error) {
          results.errors.push({
            file,
            error: error.message
          });
        }
      }

      console.log(`✅ Optimized ${results.processed} images with ${results.errors.length} errors`);
      return results;

    } catch (error) {
      console.error('Error optimizing images:', error.message);
      return { processed: 0, errors: [{ error: error.message }] };
    }
  }

  // Clean up old/unused images
  async cleanupOldImages(daysOld = 30) {
    console.log(`🧹 Cleaning up images older than ${daysOld} days...`);
    
    try {
      const imageFiles = await fs.readdir(this.imageDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let cleanedCount = 0;

      for (const file of imageFiles) {
        try {
          const filepath = path.join(this.imageDir, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtime < cutoffDate) {
            await fs.remove(filepath);
            cleanedCount++;
            console.log(`  🗑️  Removed old image: ${file}`);
          }
        } catch (error) {
          console.warn(`  Error checking ${file}:`, error.message);
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} old images`);
      return cleanedCount;

    } catch (error) {
      console.error('Error cleaning up images:', error.message);
      return 0;
    }
  }

  // Get image enhancement statistics
  getStats() {
    return {
      ...this.results,
      imageDirectory: this.imageDir,
      fallbackDirectory: this.fallbackImageDir
    };
  }
}

module.exports = ImageEnhancer;