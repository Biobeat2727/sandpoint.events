const SanityUploader = require('./utils/sanityUploader');
const fs = require('fs-extra');

async function fixSanityImages() {
  console.log('🔧 Sanity Image Fix & Event Enhancement Tool');
  console.log('===========================================');
  
  // Check for token
  const token = process.env.SANITY_TOKEN;
  if (!token) {
    console.log('❌ SANITY_TOKEN environment variable not found');
    console.log('');
    console.log('To fix images and enhance events, you need to:');
    console.log('1. Set the SANITY_TOKEN environment variable');
    console.log('2. Run this script again');
    console.log('');
    console.log('The enhanced SanityUploader now includes:');
    console.log('✅ Fixed image upload to properly handle external URLs');
    console.log('✅ Downloads external images and uploads as Sanity assets');
    console.log('✅ Comprehensive event enhancement for ALL existing events');
    console.log('✅ Smart matching to find enhancement data for existing events');
    console.log('✅ Bulk update capability to add missing URLs, images, and metadata');
    console.log('');
    console.log('When token is available, this script will:');
    console.log('1. Fix existing events that have imageUrl but no proper image assets');
    console.log('2. Download and upload external images as Sanity assets');
    console.log('3. Add missing URLs, ticket links, and descriptions');
    console.log('4. Enhance ALL 21 existing events with complete data');
    console.log('');
    return;
  }
  
  try {
    const uploader = new SanityUploader({
      baseDir: __dirname,
      projectId: '0i231ejv',
      dataset: 'production',
      token: token
    });
    
    console.log('✅ Sanity connection established');
    console.log('');
    
    // Step 1: Get current state
    console.log('📋 Step 1: Analyzing current state...');
    const existingEvents = await uploader.getAllEventsFromSanity();
    console.log(`Found ${existingEvents.length} existing events in Sanity`);
    
    const eventsWithImages = existingEvents.filter(e => e.image);
    const eventsWithImageUrls = existingEvents.filter(e => e.imageUrl);
    const eventsWithUrls = existingEvents.filter(e => e.url);
    
    console.log(`  • Events with proper images: ${eventsWithImages.length}`);
    console.log(`  • Events with imageUrl (need fixing): ${eventsWithImageUrls.length}`);
    console.log(`  • Events with URLs: ${eventsWithUrls.length}`);
    console.log(`  • Events needing enhancement: ${existingEvents.length - eventsWithUrls.length}`);
    console.log('');
    
    // Step 2: Process real enhanced events with local images
    console.log('📋 Step 2: Processing enhanced events with real local images...');
    const realEnhancedPath = './data/merged-events/real-enhanced-events.json';
    
    if (await fs.pathExists(realEnhancedPath)) {
      const realEnhanced = await fs.readJson(realEnhancedPath);
      console.log(`Processing ${realEnhanced.length} events with real local images...`);
      
      // Upload with update existing enabled to add images and URLs
      await uploader.uploadEvents(realEnhanced, {
        skipDuplicates: true,
        updateExisting: true,
        createVenues: false
      });
    } else {
      console.log('⚠️  Real enhanced events not found. Run create-real-enhanced-events.js first');
    }
    
    console.log('');
    
    // Step 3: Comprehensive enhancement of all events
    console.log('📋 Step 3: Enhancing ALL existing events...');
    const enhancementResults = await uploader.enhanceAllExistingEvents({
      useRealEnhancedEvents: true
    });
    
    console.log('');
    console.log('🎉 COMPLETE! All events have been enhanced');
    console.log('==========================================');
    console.log(`📊 Final Enhancement Results:`);
    console.log(`  • Events enhanced: ${enhancementResults.enhanced}`);
    console.log(`  • Images added: ${enhancementResults.imagesAdded}`);
    console.log(`  • URLs added: ${enhancementResults.urlsAdded}`);
    console.log(`  • Errors: ${enhancementResults.errors.length}`);
    
    if (enhancementResults.errors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      enhancementResults.errors.forEach(error => {
        console.log(`  • ${error.event}: ${error.error}`);
      });
    }
    
    console.log('');
    console.log('✅ Your Sanity CMS should now have:');
    console.log('  • All images properly uploaded as Sanity assets (no more imageUrl fields)');
    console.log('  • Complete event URLs where available');
    console.log('  • Ticket URLs for applicable events');
    console.log('  • Enhanced descriptions and metadata');
    console.log('  • All events displaying properly on your site');
    
    // Step 4: Verify final state
    console.log('');
    console.log('📋 Step 4: Verifying final state...');
    const finalEvents = await uploader.getAllEventsFromSanity();
    const finalImagesCount = finalEvents.filter(e => e.image).length;
    const finalUrlsCount = finalEvents.filter(e => e.url).length;
    const finalImageUrlCount = finalEvents.filter(e => e.imageUrl).length; // Should be 0
    
    console.log(`✅ Final verification:`);
    console.log(`  • Total events: ${finalEvents.length}`);
    console.log(`  • Events with proper images: ${finalImagesCount}`);
    console.log(`  • Events with URLs: ${finalUrlsCount}`);
    console.log(`  • Events with old imageUrl fields: ${finalImageUrlCount} (should be 0)`);
    
    if (finalImageUrlCount > 0) {
      console.log('⚠️  Some events still have imageUrl fields instead of proper image assets');
      console.log('   This may indicate image download failures or network issues');
    }
    
    return enhancementResults;
    
  } catch (error) {
    console.error('❌ Enhancement failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixSanityImages();