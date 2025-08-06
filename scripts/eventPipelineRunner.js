const SandpointOnlineScraper = require('../scrapers/sandpointOnlineScraper');
const EventbriteScraper = require('../scrapers/eventbriteScraper');
const LocalVenueScraper = require('../scrapers/localVenueScraper');
const CityOfficialScraper = require('../scrapers/cityOfficialScraper');
const EventMerger = require('../utils/eventMerger');
const fs = require('fs-extra');
const path = require('path');

class EventPipelineRunner {
  constructor(options = {}) {
    this.options = {
      runSandpointOnline: options.runSandpointOnline !== false,
      runEventbrite: options.runEventbrite !== false,
      runLocalVenues: options.runLocalVenues !== false,
      runCityOfficial: options.runCityOfficial !== false,
      runMerge: options.runMerge !== false,
      eventbriteToken: options.eventbriteToken,
      ...options
    };
    
    this.results = {
      sources: {},
      totalEvents: 0,
      mergedEvents: 0,
      errors: [],
      startTime: new Date(),
      endTime: null
    };
  }

  async runFullPipeline() {
    console.log('🚀 Starting Sandpoint Events Multi-Source Pipeline...\n');
    
    this.results.startTime = new Date();
    
    try {
      // Step 1: Scrape Sandpoint Online
      if (this.options.runSandpointOnline) {
        await this.runSandpointOnlineScraper();
      }

      // Step 2: Scrape Eventbrite
      if (this.options.runEventbrite) {
        await this.runEventbriteScraper();
      }

      // Step 3: Scrape Local Venues
      if (this.options.runLocalVenues) {
        await this.runLocalVenueScraper();
      }

      // Step 4: Scrape City Official Sources
      if (this.options.runCityOfficial) {
        await this.runCityOfficialScraper();
      }

      // Step 5: Merge all events
      if (this.options.runMerge) {
        await this.runEventMerger();
      }

      this.results.endTime = new Date();
      await this.generateFinalReport();

      console.log('✅ Pipeline completed successfully!');
      return this.results;

    } catch (error) {
      this.results.endTime = new Date();
      console.error('❌ Pipeline failed:', error.message);
      this.results.errors.push({
        step: 'pipeline',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      await this.generateFinalReport();
      throw error;
    }
  }

  async runSandpointOnlineScraper() {
    console.log('📡 Step 1/5: Scraping Sandpoint Online...');
    
    try {
      const scraper = new SandpointOnlineScraper();
      const events = await scraper.scrapeEvents();
      
      this.results.sources['Sandpoint Online'] = {
        events: events.length,
        status: 'success'
      };
      
      console.log(`✅ Sandpoint Online: ${events.length} events scraped\n`);
    } catch (error) {
      console.error(`❌ Sandpoint Online scraping failed: ${error.message}\n`);
      this.results.sources['Sandpoint Online'] = {
        events: 0,
        status: 'error',
        error: error.message
      };
      this.results.errors.push({
        step: 'sandpoint_online',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runEventbriteScraper() {
    console.log('🎫 Step 2/5: Scraping Eventbrite...');
    
    try {
      const scraper = new EventbriteScraper();
      let events;
      
      if (this.options.eventbriteToken) {
        events = await scraper.scrapeEventbriteWithAPI(this.options.eventbriteToken);
      } else {
        events = await scraper.scrapeEvents();
      }
      
      this.results.sources['Eventbrite'] = {
        events: events.length,
        status: 'success'
      };
      
      console.log(`✅ Eventbrite: ${events.length} events scraped\n`);
    } catch (error) {
      console.error(`❌ Eventbrite scraping failed: ${error.message}\n`);
      this.results.sources['Eventbrite'] = {
        events: 0,
        status: 'error',
        error: error.message
      };
      this.results.errors.push({
        step: 'eventbrite',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runLocalVenueScraper() {
    console.log('🏢 Step 3/5: Scraping Local Venues...');
    
    try {
      const scraper = new LocalVenueScraper();
      const events = await scraper.scrapeAllVenues();
      
      this.results.sources['Local Venues'] = {
        events: events.length,
        status: 'success'
      };
      
      console.log(`✅ Local Venues: ${events.length} events scraped\n`);
    } catch (error) {
      console.error(`❌ Local venues scraping failed: ${error.message}\n`);
      this.results.sources['Local Venues'] = {
        events: 0,
        status: 'error',
        error: error.message
      };
      this.results.errors.push({
        step: 'local_venues',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runCityOfficialScraper() {
    console.log('🏛️ Step 4/5: Scraping City Official Sources...');
    
    try {
      const scraper = new CityOfficialScraper();
      const events = await scraper.scrapeOfficialEvents();
      
      this.results.sources['City Official'] = {
        events: events.length,
        status: 'success'
      };
      
      console.log(`✅ City Official: ${events.length} events scraped\n`);
    } catch (error) {
      console.error(`❌ City official scraping failed: ${error.message}\n`);
      this.results.sources['City Official'] = {
        events: 0,
        status: 'error',
        error: error.message
      };
      this.results.errors.push({
        step: 'city_official',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runEventMerger() {
    console.log('🔄 Step 5/5: Merging Events...');
    
    try {
      const merger = new EventMerger();
      const mergedEvents = await merger.mergeAllEvents();
      
      this.results.mergedEvents = mergedEvents.length;
      this.results.totalEvents = Object.values(this.results.sources)
        .reduce((sum, source) => sum + (source.events || 0), 0);
      
      console.log(`✅ Event Merger: ${mergedEvents.length} events merged\n`);
    } catch (error) {
      console.error(`❌ Event merging failed: ${error.message}\n`);
      this.results.errors.push({
        step: 'merge',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async generateFinalReport() {
    const duration = this.results.endTime - this.results.startTime;
    const durationMinutes = Math.round(duration / 60000);
    
    const report = {
      pipeline_run: {
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        duration_minutes: durationMinutes,
        status: this.results.errors.length === 0 ? 'success' : 'partial_success'
      },
      sources: this.results.sources,
      summary: {
        total_events_scraped: this.results.totalEvents,
        final_merged_events: this.results.mergedEvents,
        duplicates_removed: this.results.totalEvents - this.results.mergedEvents,
        successful_sources: Object.values(this.results.sources).filter(s => s.status === 'success').length,
        failed_sources: Object.values(this.results.sources).filter(s => s.status === 'error').length
      },
      errors: this.results.errors,
      next_steps: [
        'Review merged events in data/merged-events/events.json',
        'Run image enhancement if needed',
        'Generate event summaries if needed',
        'Upload to Sanity CMS'
      ]
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'data', 'pipeline-report.json');
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, report, { spaces: 2 });

    // Print summary to console
    this.printPipelineSummary(report);

    return report;
  }

  printPipelineSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SANDPOINT EVENTS PIPELINE SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${report.pipeline_run.duration_minutes} minutes`);
    console.log(`📊 Status: ${report.pipeline_run.status.toUpperCase()}`);
    console.log(`🔢 Total Events Scraped: ${report.summary.total_events_scraped}`);
    console.log(`✨ Final Merged Events: ${report.summary.final_merged_events}`);
    console.log(`🔄 Duplicates Removed: ${report.summary.duplicates_removed}`);
    console.log(`✅ Successful Sources: ${report.summary.successful_sources}`);
    console.log(`❌ Failed Sources: ${report.summary.failed_sources}`);
    
    console.log('\n📋 SOURCE BREAKDOWN:');
    Object.entries(report.sources).forEach(([source, data]) => {
      const status = data.status === 'success' ? '✅' : '❌';
      console.log(`  ${status} ${source}: ${data.events} events`);
    });

    if (report.errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      report.errors.forEach(error => {
        console.log(`  • ${error.step}: ${error.error}`);
      });
    }

    console.log('\n🎯 NEXT STEPS:');
    report.next_steps.forEach(step => {
      console.log(`  • ${step}`);
    });
    console.log('='.repeat(60) + '\n');
  }

  // Run specific sources only
  async runSource(sourceName) {
    switch (sourceName.toLowerCase()) {
      case 'sandpoint':
      case 'sandpointonline':
        return this.runSandpointOnlineScraper();
      
      case 'eventbrite':
        return this.runEventbriteScraper();
      
      case 'venues':
      case 'localvenues':
        return this.runLocalVenueScraper();
      
      case 'city':
      case 'official':
        return this.runCityOfficialScraper();
      
      case 'merge':
        return this.runEventMerger();
      
      default:
        throw new Error(`Unknown source: ${sourceName}`);
    }
  }

  // Quick test run with limited sources
  async runQuickTest() {
    console.log('🧪 Running quick test pipeline...');
    
    this.options = {
      runSandpointOnline: true,
      runEventbrite: false,
      runLocalVenues: false,
      runCityOfficial: true,
      runMerge: true
    };

    return this.runFullPipeline();
  }
}

module.exports = EventPipelineRunner;

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  const runner = new EventPipelineRunner();

  if (args.includes('--test')) {
    runner.runQuickTest().catch(console.error);
  } else if (args.includes('--source') && args[args.indexOf('--source') + 1]) {
    const source = args[args.indexOf('--source') + 1];
    runner.runSource(source).catch(console.error);
  } else {
    runner.runFullPipeline().catch(console.error);
  }
}