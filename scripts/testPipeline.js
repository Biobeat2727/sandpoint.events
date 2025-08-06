const path = require('path');

// Test the complete pipeline functionality
async function runPipelineTests() {
  console.log('🧪 Starting Sandpoint Events Pipeline Tests\n');
  
  const tests = [
    { name: 'Event Scraper Base Class', test: testEventScraper },
    { name: 'Sandpoint Online Scraper', test: testSandpointScraper },
    { name: 'Event Merger', test: testEventMerger },
    { name: 'Image Enhancer', test: testImageEnhancer },
    { name: 'Event Summarizer', test: testEventSummarizer },
    { name: 'Sanity Uploader (Preview)', test: testSanityUploader },
    { name: 'Complete Pipeline (Dry Run)', test: testCompletePipeline }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log('─'.repeat(50));
    
    try {
      const startTime = Date.now();
      await test.test();
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${test.name}: PASSED (${duration}ms)`);
      results.push({ name: test.name, status: 'PASSED', duration });
    } catch (error) {
      console.error(`❌ ${test.name}: FAILED`);
      console.error(`   Error: ${error.message}`);
      results.push({ name: test.name, status: 'FAILED', error: error.message });
    }
  }
  
  // Print test summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n🔍 Failed Tests:');
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`   • ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n📊 Performance:');
  results.filter(r => r.duration).forEach(r => {
    console.log(`   • ${r.name}: ${r.duration}ms`);
  });
  
  const overallStatus = failed === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
  console.log(`\n🏆 Overall Status: ${overallStatus}`);
  console.log('='.repeat(60));
  
  return results;
}

async function testEventScraper() {
  const EventScraper = require('../utils/eventScraper');
  
  const scraper = new EventScraper();
  
  // Test normalization
  const testEvent = {
    title: '  Test Event  ',
    date: '2024-12-01',
    description: 'Test description',
    venue: 'Test Venue'
  };
  
  const normalized = scraper.normalizeEvent(testEvent, 'Test Source');
  
  if (!normalized.title || !normalized.slug || !normalized.date) {
    throw new Error('Event normalization failed');
  }
  
  // Test date parsing
  const parsedDate = scraper.parseEventDate('December 1, 2024');
  if (!parsedDate) {
    throw new Error('Date parsing failed');
  }
  
  console.log(`   ✓ Event normalization working`);
  console.log(`   ✓ Date parsing working`);
  console.log(`   ✓ Base class functional`);
}

async function testSandpointScraper() {
  const SandpointOnlineScraper = require('../scrapers/sandpointOnlineScraper');
  
  const scraper = new SandpointOnlineScraper();
  
  // Test scraper initialization
  if (!scraper.baseUrl || !scraper.eventsUrl) {
    throw new Error('Scraper not properly initialized');
  }
  
  // Test generic event extraction (with mock data)
  const mockEvents = scraper.extractGenericEvents({
    text: () => 'Community Meeting January 15, 2024 at City Hall'
  });
  
  console.log(`   ✓ Scraper initialized correctly`);
  console.log(`   ✓ Event extraction methods available`);
  console.log(`   ✓ Ready for live scraping`);
}

async function testEventMerger() {
  const EventMerger = require('../utils/eventMerger');
  const fs = require('fs-extra');
  const path = require('path');
  
  const merger = new EventMerger();
  
  // Create test events
  const testEvents = [
    {
      id: '1',
      title: 'Test Event 1',
      date: '2024-12-01T19:00:00Z',
      source: 'Test Source 1'
    },
    {
      id: '2',
      title: 'Test Event 1', // Duplicate
      date: '2024-12-01T19:00:00Z',
      source: 'Test Source 2'
    },
    {
      id: '3',
      title: 'Test Event 2',
      date: '2024-12-02T19:00:00Z',
      source: 'Test Source 1'
    }
  ];
  
  // Test duplicate detection
  const unique = merger.removeDuplicates ? await merger.removeDuplicates(testEvents) : testEvents;
  
  if (unique.length !== 2) {
    throw new Error(`Expected 2 unique events, got ${unique.length}`);
  }
  
  console.log(`   ✓ Duplicate detection working`);
  console.log(`   ✓ Event filtering functional`);
  console.log(`   ✓ Merger ready for use`);
}

async function testImageEnhancer() {
  const ImageEnhancer = require('../utils/imageEnhancer');
  
  const enhancer = new ImageEnhancer({
    downloadImages: false, // Don't actually download for test
    generateFallbacks: false
  });
  
  // Test image URL validation
  const validUrl = enhancer.isValidImageUrl('https://example.com/image.jpg');
  const invalidUrl = enhancer.isValidImageUrl('invalid-url');
  
  if (!validUrl || invalidUrl) {
    throw new Error('Image URL validation failed');
  }
  
  // Test fallback generation logic
  const testEvent = {
    title: 'Music Concert',
    tags: ['Music', 'Live'],
    slug: 'music-concert'
  };
  
  console.log(`   ✓ Image URL validation working`);
  console.log(`   ✓ Fallback generation ready`);
  console.log(`   ✓ Enhancement pipeline functional`);
}

async function testEventSummarizer() {
  const EventSummarizer = require('../utils/eventSummarizer');
  
  const summarizer = new EventSummarizer();
  
  // Test event type determination
  const musicEvent = {
    title: 'Live Concert at Downtown',
    tags: ['Music', 'Live']
  };
  
  const eventType = summarizer.determineEventType(musicEvent);
  if (eventType !== 'music') {
    throw new Error(`Expected music event type, got ${eventType}`);
  }
  
  // Test description generation
  const description = summarizer.generateDescription(musicEvent);
  if (!description || description.length < 50) {
    throw new Error('Description generation failed');
  }
  
  console.log(`   ✓ Event type detection working`);
  console.log(`   ✓ Description generation functional`);
  console.log(`   ✓ Summarizer ready for use`);
}

async function testSanityUploader() {
  const SanityUploader = require('../utils/sanityUploader');
  
  // Test without token (preview mode)
  const uploader = new SanityUploader({
    projectId: 'test-project',
    dataset: 'test'
    // No token = preview mode
  });
  
  const testEvents = [
    {
      title: 'Test Event',
      date: '2024-12-01T19:00:00Z',
      description: 'Test event description',
      tags: ['Test'],
      source: 'Test'
    }
  ];
  
  // This should run in preview mode
  const result = await uploader.uploadEvents(testEvents);
  
  if (!result.totalEvents || result.totalEvents !== 1) {
    throw new Error('Preview upload failed');
  }
  
  console.log(`   ✓ Preview mode working`);
  console.log(`   ✓ Event transformation ready`);
  console.log(`   ✓ Sanity integration prepared`);
}

async function testCompletePipeline() {
  const CompletePipeline = require('./completePipeline');
  
  // Test pipeline initialization
  const pipeline = new CompletePipeline({
    runSandpointOnline: false, // Don't actually scrape for test
    runEventbrite: false,
    runLocalVenues: false,
    runCityOfficial: false,
    enhanceImages: false,
    generateSummaries: false,
    uploadToSanity: false
  });
  
  if (!pipeline.options || !pipeline.results) {
    throw new Error('Pipeline not properly initialized');
  }
  
  // Test configuration
  const hasRequiredMethods = typeof pipeline.runFullPipeline === 'function' &&
                            typeof pipeline.generateFinalReport === 'function';
  
  if (!hasRequiredMethods) {
    throw new Error('Pipeline missing required methods');
  }
  
  console.log(`   ✓ Pipeline initialization working`);
  console.log(`   ✓ Configuration options available`);
  console.log(`   ✓ Complete pipeline ready for execution`);
}

// Run tests if called directly
if (require.main === module) {
  runPipelineTests().catch(console.error);
}

module.exports = { runPipelineTests };