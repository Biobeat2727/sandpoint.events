#!/usr/bin/env node

const CompletePipeline = require('./completePipeline');
const EventPipelineRunner = require('./eventPipelineRunner');
const ImageEnhancer = require('../utils/imageEnhancer');
const EventSummarizer = require('../utils/eventSummarizer');
const SanityUploader = require('../utils/sanityUploader');
const EventMerger = require('../utils/eventMerger');

const { program } = require('commander');
const fs = require('fs-extra');
const path = require('path');

// Set up CLI commands
program
  .name('sandpoint-events')
  .description('Sandpoint Events Multi-Source Pipeline CLI')
  .version('1.0.0');

// Full pipeline command
program
  .command('run')
  .description('Run the complete event pipeline')
  .option('--no-images', 'Skip image enhancement')
  .option('--no-summaries', 'Skip summary generation')
  .option('--no-upload', 'Skip Sanity upload (preview mode)')
  .option('--no-sandpoint', 'Skip Sandpoint Online scraping')
  .option('--no-eventbrite', 'Skip Eventbrite scraping')
  .option('--no-venues', 'Skip local venue scraping')
  .option('--no-city', 'Skip city official scraping')
  .option('--test', 'Run quick test with limited sources')
  .action(async (options) => {
    try {
      const pipeline = new CompletePipeline({
        enhanceImages: options.images,
        generateSummaries: options.summaries,
        uploadToSanity: options.upload,
        runSandpointOnline: options.sandpoint,
        runEventbrite: options.eventbrite,
        runLocalVenues: options.venues,
        runCityOfficial: options.city
      });

      if (options.test) {
        await pipeline.runQuickTest();
      } else {
        await pipeline.runFullPipeline();
      }
    } catch (error) {
      console.error('Pipeline failed:', error.message);
      process.exit(1);
    }
  });

// Individual scraping commands
program
  .command('scrape [source]')
  .description('Run scraping for specific source (sandpoint, eventbrite, venues, city)')
  .action(async (source) => {
    try {
      const runner = new EventPipelineRunner();
      
      if (source) {
        await runner.runSource(source);
      } else {
        await runner.runFullPipeline();
      }
    } catch (error) {
      console.error('Scraping failed:', error.message);
      process.exit(1);
    }
  });

// Merge command
program
  .command('merge')
  .description('Merge scraped events and remove duplicates')
  .action(async () => {
    try {
      const merger = new EventMerger();
      const events = await merger.mergeAllEvents();
      console.log(`✅ Merged ${events.length} events`);
    } catch (error) {
      console.error('Merge failed:', error.message);
      process.exit(1);
    }
  });

// Image enhancement command
program
  .command('enhance-images')
  .description('Download and enhance event images')
  .option('--no-download', 'Skip downloading images')
  .option('--no-fallbacks', 'Skip generating fallback images')
  .action(async (options) => {
    try {
      const eventsPath = path.join(process.cwd(), 'data', 'merged-events', 'events.json');
      const events = await fs.readJson(eventsPath);
      
      const enhancer = new ImageEnhancer({
        downloadImages: options.download,
        generateFallbacks: options.fallbacks
      });
      
      await enhancer.enhanceEventImages(events);
      console.log('✅ Image enhancement complete');
    } catch (error) {
      console.error('Image enhancement failed:', error.message);
      process.exit(1);
    }
  });

// Summary generation command
program
  .command('summarize')
  .description('Generate and improve event summaries')
  .option('--max-length <number>', 'Maximum summary length', 250)
  .action(async (options) => {
    try {
      const eventsPath = path.join(process.cwd(), 'data', 'merged-events', 'events.json');
      const events = await fs.readJson(eventsPath);
      
      const summarizer = new EventSummarizer({
        maxSummaryLength: parseInt(options.maxLength)
      });
      
      await summarizer.generateEventSummaries(events);
      console.log('✅ Summary generation complete');
    } catch (error) {
      console.error('Summary generation failed:', error.message);
      process.exit(1);
    }
  });

// Sanity upload command
program
  .command('upload')
  .description('Upload events to Sanity CMS')
  .option('--preview', 'Preview mode (no actual upload)')
  .option('--project <id>', 'Sanity project ID')
  .option('--dataset <name>', 'Sanity dataset name', 'production')
  .option('--token <token>', 'Sanity API token')
  .action(async (options) => {
    try {
      const uploader = new SanityUploader({
        projectId: options.project,
        dataset: options.dataset,
        token: options.preview ? null : options.token
      });
      
      await uploader.uploadMergedEvents({
        skipDuplicates: true,
        updateExisting: true,
        createVenues: true
      });
      
      console.log('✅ Sanity upload complete');
    } catch (error) {
      console.error('Sanity upload failed:', error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show pipeline status and recent runs')
  .action(async () => {
    try {
      console.log('📊 Sandpoint Events Pipeline Status\n');
      
      // Check for data files
      const dataDir = path.join(process.cwd(), 'data');
      const files = [
        { path: 'scraped-events', desc: 'Raw scraped events' },
        { path: 'merged-events/events.json', desc: 'Merged events' },
        { path: 'merged-events/events-enhanced.json', desc: 'Enhanced events' },
        { path: 'merged-events/events-summarized.json', desc: 'Summarized events' },
        { path: 'complete-pipeline-report.json', desc: 'Last pipeline run' }
      ];
      
      for (const file of files) {
        const fullPath = path.join(dataDir, file.path);
        if (await fs.pathExists(fullPath)) {
          const stats = await fs.stat(fullPath);
          const isDir = stats.isDirectory();
          
          if (isDir) {
            const subFiles = await fs.readdir(fullPath);
            console.log(`✅ ${file.desc}: ${subFiles.length} files (${stats.mtime.toLocaleDateString()})`);
          } else {
            const size = Math.round(stats.size / 1024);
            console.log(`✅ ${file.desc}: ${size}KB (${stats.mtime.toLocaleDateString()})`);
          }
        } else {
          console.log(`❌ ${file.desc}: Not found`);
        }
      }
      
      // Show last pipeline run if available
      const reportPath = path.join(dataDir, 'complete-pipeline-report.json');
      if (await fs.pathExists(reportPath)) {
        const report = await fs.readJson(reportPath);
        console.log('\n📋 Last Pipeline Run:');
        console.log(`   Date: ${report.pipeline_run?.timestamp || 'Unknown'}`);
        console.log(`   Duration: ${report.pipeline_run?.duration_minutes || 0} minutes`);
        console.log(`   Status: ${report.pipeline_run?.status || 'Unknown'}`);
        console.log(`   Events: ${report.results?.scraping?.final_merged_events || 0}`);
        console.log(`   Errors: ${report.errors?.length || 0}`);
      }
      
    } catch (error) {
      console.error('Status check failed:', error.message);
      process.exit(1);
    }
  });

// Clean command
program
  .command('clean')
  .description('Clean up old data files')
  .option('--days <number>', 'Remove files older than N days', 7)
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (options) => {
    try {
      console.log(`🧹 Cleaning files older than ${options.days} days...\n`);
      
      const dataDir = path.join(process.cwd(), 'data');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(options.days));
      
      let cleanedCount = 0;
      
      // Clean scraped events
      const scrapedDir = path.join(dataDir, 'scraped-events');
      if (await fs.pathExists(scrapedDir)) {
        const files = await fs.readdir(scrapedDir);
        
        for (const file of files) {
          const filePath = path.join(scrapedDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            if (options.dryRun) {
              console.log(`Would delete: ${file} (${stats.mtime.toLocaleDateString()})`);
            } else {
              await fs.remove(filePath);
              console.log(`Deleted: ${file}`);
            }
            cleanedCount++;
          }
        }
      }
      
      // Clean image cache
      const imageEnhancer = new ImageEnhancer();
      if (!options.dryRun) {
        const imagesCleaned = await imageEnhancer.cleanupOldImages(parseInt(options.days));
        cleanedCount += imagesCleaned;
      }
      
      if (options.dryRun) {
        console.log(`\n📊 Would clean ${cleanedCount} files/images`);
      } else {
        console.log(`\n✅ Cleaned ${cleanedCount} files/images`);
      }
      
    } catch (error) {
      console.error('Clean failed:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}