#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');

class DataConsolidator {
  constructor() {
    this.baseDir = process.cwd();
    this.scrapedDir = path.join(this.baseDir, 'data', 'scraped-events');
    this.activeDir = path.join(this.baseDir, 'data', 'active');
    this.archiveDir = path.join(this.baseDir, 'data', 'archive');
    
    // Ensure directories exist
    fs.ensureDirSync(this.activeDir);
    fs.ensureDirSync(this.archiveDir);
  }

  async consolidateAllSources() {
    console.log('🚀 Starting data consolidation to active directory...\n');
    
    const sources = ['sandpoint-online', 'eventbrite', 'schweitzer', 'local-venues'];
    
    for (const source of sources) {
      await this.consolidateSource(source);
    }
    
    console.log('\n✅ Consolidation complete!');
    console.log(`Active directory: ${this.activeDir}`);
    console.log(`Files ready for merger: ${(await fs.readdir(this.activeDir)).filter(f => f.endsWith('.json')).join(', ')}`);
  }
  
  async consolidateSource(sourceName) {
    console.log(`📋 Processing ${sourceName}...`);
    
    try {
      // Find all files for this source (excluding sessions and latest subdirs)
      const pattern = path.join(this.scrapedDir, `${sourceName}*.json`).replace(/\\/g, '/');
      const files = await glob(pattern, {
        ignore: ['**/sessions/**', '**/latest/**']
      });
      
      console.log(`   Found ${files.length} files`);
      
      if (files.length === 0) {
        console.log(`   ⚠️  No files found for ${sourceName}`);
        return;
      }
      
      // Consolidate all events
      const allEvents = [];
      const seenIds = new Set();
      
      for (const file of files) {
        try {
          const data = await fs.readJson(file);
          const events = Array.isArray(data) ? data : [data];
          
          // Deduplicate by ID
          for (const event of events) {
            if (event.id && !seenIds.has(event.id)) {
              allEvents.push(event);
              seenIds.add(event.id);
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Error reading ${path.basename(file)}: ${error.message}`);
        }
      }
      
      console.log(`   📊 Consolidated: ${allEvents.length} unique events`);
      
      // Save to active directory
      const outputFile = path.join(this.activeDir, `${sourceName}.json`);
      await fs.writeJson(outputFile, allEvents, { spaces: 2 });
      console.log(`   ✅ Saved to: ${path.basename(outputFile)}`);
      
    } catch (error) {
      console.error(`   ❌ Error processing ${sourceName}:`, error.message);
    }
  }
  
  async archiveOldData() {
    const today = new Date().toISOString().split('T')[0];
    const archiveSessionDir = path.join(this.archiveDir, today);
    
    console.log(`\n📦 Archiving old scraped data to: ${archiveSessionDir}`);
    
    // Create archive session directory
    fs.ensureDirSync(archiveSessionDir);
    
    try {
      // Move the entire scraped-events directory to archive
      const archiveTarget = path.join(archiveSessionDir, 'scraped-events');
      await fs.move(this.scrapedDir, archiveTarget);
      console.log('   ✅ Old data archived');
      
      // Recreate empty scraped-events directory for legacy compatibility
      fs.ensureDirSync(this.scrapedDir);
      
    } catch (error) {
      console.error('   ⚠️  Archive failed:', error.message);
    }
  }
}

// Run consolidation
async function main() {
  const consolidator = new DataConsolidator();
  
  try {
    await consolidator.consolidateAllSources();
    
    // Ask user if they want to archive old data
    console.log('\n❓ Archive old scraped-events directory? (This will clean up file chaos)');
    console.log('   Run: node utils/consolidateScrapedData.js --archive');
    
    if (process.argv.includes('--archive')) {
      await consolidator.archiveOldData();
    }
    
  } catch (error) {
    console.error('❌ Consolidation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DataConsolidator;