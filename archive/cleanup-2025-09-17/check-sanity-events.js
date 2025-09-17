const { createClient } = require('@sanity/client');

const client = createClient({
  projectId: '0i231ejv',
  dataset: 'production',
  token: process.env.SANITY_TOKEN,
  apiVersion: '2023-05-03',
  useCdn: false
});

async function getAllEvents() {
  try {
    const events = await client.fetch('*[_type == "event"] | order(date asc)');
    console.log('Total events in Sanity:', events.length);
    console.log('Events with images:', events.filter(e => e.image).length);
    console.log('Events with imageUrl:', events.filter(e => e.imageUrl).length);
    console.log('Events with URLs:', events.filter(e => e.url).length);
    
    console.log('\nFirst few events:');
    events.slice(0, 5).forEach((event, i) => {
      console.log(`${i + 1}. ${event.title}`);
      console.log('   Date:', event.date);
      console.log('   Has image:', !!event.image);
      console.log('   Has imageUrl:', !!event.imageUrl);
      console.log('   Has URL:', !!event.url);
      if (event.imageUrl) {
        console.log('   ImageUrl:', event.imageUrl);
      }
      if (event.image) {
        console.log('   Image object:', JSON.stringify(event.image, null, 2));
      }
      console.log('');
    });

    // Save all events to a file for analysis
    const fs = require('fs-extra');
    await fs.writeJson('./sanity-events-current.json', events, { spaces: 2 });
    console.log('All events saved to sanity-events-current.json');

  } catch (error) {
    console.error('Error fetching events:', error.message);
  }
}

getAllEvents();