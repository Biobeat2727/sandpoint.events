const EventPipelineRunner = require('./eventPipelineRunner');
const ImageEnhancer = require('../utils/imageEnhancer');
const EventSummarizer = require('../utils/eventSummarizer');
const SanityUploader = require('../utils/sanityUploader');
const fs = require('fs-extra');
const path = require('path');

class CompletePipeline {
  constructor(options = {}) {
    this.options = {
      // Scraping options
      runSandpointOnline: options.runSandpointOnline !== false,
      runEventbrite: options.runEventbrite !== false,
      runLocalVenues: options.runLocalVenues !== false,
      runCityOfficial: options.runCityOfficial !== false,
      runFacebook: options.runFacebook === true, // Disabled by default
      eventbriteToken: options.eventbriteToken,
      
      // Enhancement options
      enhanceImages: options.enhanceImages !== false,
      generateSummaries: options.generateSummaries !== false,
      
      // Upload options
      uploadToSanity: options.uploadToSanity !== false,
      sanityProjectId: options.sanityProjectId,
      sanityDataset: options.sanityDataset,
      sanityToken: options.sanityToken,
      
      // Pipeline options
      skipExistingSteps: options.skipExistingSteps === true,
      ...options
    };
    
    this.results = {
      pipeline: {},
      images: {},
      summaries: {},
      sanity: {},
      errors: [],
      startTime: new Date(),
      endTime: null,
      totalDuration: 0
    };
  }

  async runFullPipeline() {
    console.log('🌟 STARTING COMPLETE SANDPOINT EVENTS PIPELINE');
    console.log('===============================================');
    console.log('This will run the complete 7-step pipeline:');
    console.log('1. 📡 Multi-source event scraping');
    console.log('2. 🔄 Event merging and deduplication');
    console.log('3. 🎨 Image enhancement (optional)');
    console.log('4. 📝 Summary generation (optional)');
    console.log('5. 🚀 Upload to Sanity CMS');
    console.log('===============================================\n');

    this.results.startTime = new Date();

    try {
      // Step 1-2: Run scraping and merging pipeline
      console.log('🚀 STEP 1-2: Running scraping and merging pipeline...\n');
      await this.runScrapingPipeline();

      // Step 3: Image enhancement (optional)
      if (this.options.enhanceImages) {
        console.log('\n🎨 STEP 3: Enhancing event images...\n');
        await this.runImageEnhancement();
      } else {
        console.log('\n⏭️  STEP 3: Image enhancement skipped (disabled)\n');
      }

      // Step 4: Summary generation (optional)
      if (this.options.generateSummaries) {
        console.log('\n📝 STEP 4: Generating event summaries...\n');
        await this.runSummaryGeneration();
      } else {
        console.log('\n⏭️  STEP 4: Summary generation skipped (disabled)\n');
      }

      // Step 5: Upload to Sanity (optional)
      if (this.options.uploadToSanity) {
        console.log('\n🚀 STEP 5: Uploading to Sanity CMS...\n');
        await this.runSanityUpload();
      } else {
        console.log('\n⏭️  STEP 5: Sanity upload skipped (disabled)\n');
      }

      this.results.endTime = new Date();
      this.results.totalDuration = this.results.endTime - this.results.startTime;

      await this.generateFinalReport();
      this.printFinalSummary();

      console.log('\n✅ COMPLETE PIPELINE FINISHED SUCCESSFULLY! 🎉');
      return this.results;

    } catch (error) {
      this.results.endTime = new Date();
      this.results.totalDuration = this.results.endTime - this.results.startTime;
      
      console.error('\n❌ PIPELINE FAILED:', error.message);
      this.results.errors.push({
        step: 'pipeline',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      await this.generateFinalReport();
      throw error;
    }
  }

  async runScrapingPipeline() {
    try {
      const pipelineRunner = new EventPipelineRunner({
        runSandpointOnline: this.options.runSandpointOnline,
        runEventbrite: this.options.runEventbrite,
        runLocalVenues: this.options.runLocalVenues,
        runCityOfficial: this.options.runCityOfficial,
        eventbriteToken: this.options.eventbriteToken
      });

      this.results.pipeline = await pipelineRunner.runFullPipeline();
      
      console.log(`✅ Scraping pipeline completed with ${this.results.pipeline.mergedEvents} final events`);
      
    } catch (error) {
      console.error('❌ Scraping pipeline failed:', error.message);
      this.results.errors.push({
        step: 'scraping_pipeline',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async runImageEnhancement() {
    try {
      // Load the latest events
      const eventsPath = path.join(process.cwd(), 'data', 'merged-events', 'events.json');
      const events = await fs.readJson(eventsPath);

      const imageEnhancer = new ImageEnhancer({
        downloadImages: true,
        generateFallbacks: true
      });

      const enhancedEvents = await imageEnhancer.enhanceEventImages(events);
      this.results.images = imageEnhancer.getStats();

      console.log(`✅ Image enhancement completed for ${enhancedEvents.length} events`);

    } catch (error) {
      console.error('❌ Image enhancement failed:', error.message);
      this.results.errors.push({
        step: 'image_enhancement',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Non-critical error, continue pipeline
      console.log('⚠️  Continuing pipeline without image enhancement...');
    }
  }

  async runSummaryGeneration() {
    try {
      // Use enhanced events if available, otherwise use merged events
      let eventsPath = path.join(process.cwd(), 'data', 'merged-events', 'events-enhanced.json');
      
      if (!(await fs.pathExists(eventsPath))) {
        eventsPath = path.join(process.cwd(), 'data', 'merged-events', 'events.json');
      }

      const events = await fs.readJson(eventsPath);

      const summarizer = new EventSummarizer({
        maxSummaryLength: 250,
        generateShortSummary: true,
        improveExistingDescriptions: true,
        addKeywords: true
      });

      const summarizedEvents = await summarizer.generateEventSummaries(events);
      this.results.summaries = summarizer.getStats();

      console.log(`✅ Summary generation completed for ${summarizedEvents.length} events`);

    } catch (error) {
      console.error('❌ Summary generation failed:', error.message);
      this.results.errors.push({
        step: 'summary_generation',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Non-critical error, continue pipeline
      console.log('⚠️  Continuing pipeline without summary generation...');
    }
  }

  async runSanityUpload() {
    try {
      const uploader = new SanityUploader({
        projectId: this.options.sanityProjectId,
        dataset: this.options.sanityDataset,
        token: this.options.sanityToken
      });

      // Use the most processed version of events available
      const eventsPaths = [
        path.join(process.cwd(), 'data', 'merged-events', 'events-summarized.json'),
        path.join(process.cwd(), 'data', 'merged-events', 'events-enhanced.json'),
        path.join(process.cwd(), 'data', 'merged-events', 'events.json')
      ];

      let eventsPath = null;
      for (const ePath of eventsPaths) {
        if (await fs.pathExists(ePath)) {
          eventsPath = ePath;
          break;
        }
      }

      if (!eventsPath) {
        throw new Error('No events file found for upload');
      }

      console.log(`📋 Using events from: ${path.basename(eventsPath)}`);
      const events = await fs.readJson(eventsPath);

      this.results.sanity = await uploader.uploadEvents(events, {
        skipDuplicates: true,
        updateExisting: true,
        createVenues: true
      });

      console.log(`✅ Sanity upload completed for ${this.results.sanity.eventsUploaded} events`);

    } catch (error) {
      console.error('❌ Sanity upload failed:', error.message);
      this.results.errors.push({
        step: 'sanity_upload',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Upload failure is significant but shouldn't stop report generation
      console.log('⚠️  Pipeline completed but upload failed. Check configuration.');
    }
  }

  async generateFinalReport() {
    const report = {
      pipeline_run: {
        timestamp: new Date().toISOString(),
        duration_ms: this.results.totalDuration,
        duration_minutes: Math.round(this.results.totalDuration / 60000),
        status: this.results.errors.length === 0 ? 'success' : 'partial_success'
      },
      configuration: {
        scraping: {
          sandpoint_online: this.options.runSandpointOnline,
          eventbrite: this.options.runEventbrite,
          local_venues: this.options.runLocalVenues,
          city_official: this.options.runCityOfficial,
          facebook: this.options.runFacebook
        },
        enhancements: {
          images: this.options.enhanceImages,
          summaries: this.options.generateSummaries,
          sanity_upload: this.options.uploadToSanity
        }
      },
      results: {
        scraping: this.results.pipeline.summary || {},
        images: this.results.images,
        summaries: this.results.summaries,
        sanity: this.results.sanity
      },
      errors: this.results.errors,
      files_generated: await this.getGeneratedFiles(),
      next_steps: this.generateNextSteps()
    };

    const reportPath = path.join(process.cwd(), 'data', 'complete-pipeline-report.json');
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(`📋 Complete pipeline report saved to ${reportPath}`);
    return report;
  }

  async getGeneratedFiles() {
    const files = [];
    const dataDir = path.join(process.cwd(), 'data');
    
    const filesToCheck = [
      'scraped-events/*.json',
      'merged-events/events.json',
      'merged-events/events-enhanced.json',
      'merged-events/events-summarized.json',
      'merged-events/merge-report.json',
      'pipeline-report.json',
      'sanity-upload-report.json',
      'complete-pipeline-report.json'
    ];

    for (const filePattern of filesToCheck) {
      const fullPath = path.join(dataDir, filePattern);
      try {
        if (await fs.pathExists(fullPath)) {
          const stats = await fs.stat(fullPath);
          files.push({
            path: filePattern,
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        }
      } catch (error) {
        // Ignore file check errors
      }
    }

    return files;
  }

  generateNextSteps() {
    const steps = [];
    
    if (this.results.errors.length > 0) {
      steps.push('Review and resolve pipeline errors');
    }
    
    if (!this.options.enhanceImages) {
      steps.push('Consider running image enhancement for better event presentation');
    }
    
    if (!this.options.generateSummaries) {
      steps.push('Consider running summary generation for consistent event descriptions');
    }
    
    if (!this.options.uploadToSanity || this.results.sanity.eventsUploaded === 0) {
      steps.push('Upload events to Sanity CMS for website display');
    }
    
    steps.push('Review events in Sanity Studio and publish');
    steps.push('Update website to display new events');
    steps.push('Schedule regular pipeline runs for ongoing updates');

    return steps;
  }

  printFinalSummary() {
    const duration = Math.round(this.results.totalDuration / 60000);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎯 COMPLETE SANDPOINT EVENTS PIPELINE SUMMARY');
    console.log('='.repeat(70));
    console.log(`⏱️  Total Duration: ${duration} minutes`);
    console.log(`📊 Final Status: ${this.results.errors.length === 0 ? '✅ SUCCESS' : '⚠️  PARTIAL SUCCESS'}`);
    
    if (this.results.pipeline.summary) {
      console.log(`\n📡 SCRAPING RESULTS:`);
      console.log(`   • Events scraped: ${this.results.pipeline.summary.total_events_scraped || 0}`);
      console.log(`   • Final events: ${this.results.pipeline.summary.final_merged_events || 0}`);
      console.log(`   • Duplicates removed: ${this.results.pipeline.summary.duplicates_removed || 0}`);
      console.log(`   • Sources processed: ${this.results.pipeline.summary.successful_sources || 0}`);
    }

    if (this.results.images.processed) {
      console.log(`\n🎨 IMAGE ENHANCEMENT:`);
      console.log(`   • Images processed: ${this.results.images.processed}`);
      console.log(`   • Images downloaded: ${this.results.images.downloaded}`);
      console.log(`   • Fallbacks generated: ${this.results.images.fallbacksGenerated}`);
    }

    if (this.results.summaries.processed) {
      console.log(`\n📝 SUMMARY GENERATION:`);
      console.log(`   • Events processed: ${this.results.summaries.processed}`);
      console.log(`   • Summaries generated: ${this.results.summaries.summariesGenerated}`);
      console.log(`   • Descriptions improved: ${this.results.summaries.descriptionsImproved}`);
    }

    if (this.results.sanity.eventsUploaded !== undefined) {
      console.log(`\n🚀 SANITY UPLOAD:`);
      console.log(`   • Events uploaded: ${this.results.sanity.eventsUploaded}`);
      console.log(`   • Events updated: ${this.results.sanity.eventsUpdated || 0}`);
      console.log(`   • Venues created: ${this.results.sanity.venuesCreated || 0}`);
    }

    if (this.results.errors.length > 0) {
      console.log(`\n⚠️  ERRORS (${this.results.errors.length}):`);
      this.results.errors.forEach(error => {
        console.log(`   • ${error.step}: ${error.error}`);
      });
    }

    console.log('\n🎯 KEY FILES GENERATED:');
    console.log('   • data/merged-events/events.json - Final merged events');
    console.log('   • data/complete-pipeline-report.json - Detailed report');
    console.log('   • public/images/eventimages/ - Downloaded event images');

    console.log('\n🚀 WHAT\'S NEXT:');
    console.log('   1. Review events in your Sanity Studio');
    console.log('   2. Publish approved events to your website');
    console.log('   3. Set up automated scheduling for regular updates');
    console.log('   4. Monitor event quality and adjust scrapers as needed');

    console.log('='.repeat(70) + '\n');
  }

  // Quick test run
  async runQuickTest() {
    console.log('🧪 Running quick pipeline test...');
    
    this.options = {
      runSandpointOnline: true,
      runEventbrite: false,
      runLocalVenues: false,
      runCityOfficial: false,
      runFacebook: false,
      enhanceImages: false,
      generateSummaries: true,
      uploadToSanity: false // Preview only for testing
    };

    return this.runFullPipeline();
  }
}

module.exports = CompletePipeline;

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options = {
    enhanceImages: !args.includes('--no-images'),
    generateSummaries: !args.includes('--no-summaries'),
    uploadToSanity: !args.includes('--no-upload'),
    runSandpointOnline: !args.includes('--no-sandpoint'),
    runEventbrite: !args.includes('--no-eventbrite'),
    runLocalVenues: !args.includes('--no-venues'),
    runCityOfficial: !args.includes('--no-city')
  };

  const pipeline = new CompletePipeline(options);

  if (args.includes('--test')) {
    pipeline.runQuickTest().catch(console.error);
  } else {
    pipeline.runFullPipeline().catch(console.error);
  }
}