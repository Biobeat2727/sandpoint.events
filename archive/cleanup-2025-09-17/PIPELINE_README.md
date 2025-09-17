# Sandpoint Events Multi-Source Pipeline

A comprehensive automated pipeline for scraping, processing, and managing events from multiple sources around Sandpoint, Idaho.

## Overview

This pipeline automatically collects events from multiple sources, removes duplicates, enhances data, and uploads to Sanity CMS for your events website.

### Pipeline Steps

1. **📡 Multi-Source Scraping** - Collect events from various sources
2. **🔄 Data Merging** - Combine and deduplicate events
3. **🎨 Image Enhancement** - Download and optimize event images
4. **📝 Summary Generation** - Create consistent event descriptions
5. **🚀 Sanity Upload** - Publish to your CMS

## Supported Event Sources

- **Sandpoint Online** - Local community events
- **Eventbrite** - Regional event platform
- **Local Venues** - Theaters, bars, community centers
  - Panida Theater
  - The Hive
  - MickDuff's Beer Hall
  - Eichardt's Pub
  - Festival at Sandpoint
  - Bonner County Fairgrounds
- **City Official** - Government and chamber sources
  - City of Sandpoint
  - Greater Sandpoint Chamber
  - Visit Sandpoint
- **Facebook Events** - Social media events (API required)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env.local` file:
```bash
# Sanity CMS Configuration
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_TOKEN=your_token

# Optional API Keys
EVENTBRITE_TOKEN=your_eventbrite_token
```

### 3. Run Test Pipeline
```bash
npm run events:test
```

### 4. Run Full Pipeline
```bash
npm run events:run
```

## Command Line Interface

### Complete Pipeline
```bash
# Run full pipeline
npm run events:run

# Test run with limited sources
npm run events:test

# Skip certain steps
npm run events:run -- --no-images --no-summaries
```

### Individual Steps
```bash
# Scrape from all sources
npm run events:scrape

# Scrape specific source
npm run events:scrape -- sandpoint
npm run events:scrape -- eventbrite
npm run events:scrape -- venues
npm run events:scrape -- city

# Merge scraped events
npm run events:merge

# Enhance images
npm run events:enhance

# Generate summaries
npm run events:summarize

# Upload to Sanity (preview)
npm run events:upload

# Upload to Sanity (live)
npm run events:upload:live
```

### Maintenance
```bash
# Check pipeline status
npm run events:status

# Clean old files
npm run events:clean

# Show help
npm run events:help
```

## Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Raw Sources   │    │   Scraped Data  │    │  Merged Events  │
│                 │───▶│                 │───▶│                 │
│ • Sandpoint     │    │ • JSON files    │    │ • events.json   │
│ • Eventbrite    │    │ • Per source    │    │ • Deduplicated  │
│ • Local Venues  │    │ • Timestamped   │    │ • Validated     │
│ • City Official │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sanity CMS    │    │   Enhanced      │    │   Summarized    │
│                 │◀───│   Events        │◀───│   Events        │
│ • Published     │    │                 │    │                 │
│ • Live Website  │    │ • Images        │    │ • Descriptions  │
│ • Event Pages   │    │ • Optimized     │    │ • Keywords      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Generated Files

### Input/Output Structure
```
data/
├── scraped-events/          # Raw scraped data
│   ├── sandpoint-online-YYYY-MM-DD.json
│   ├── eventbrite-YYYY-MM-DD.json
│   ├── local-venues-YYYY-MM-DD.json
│   └── city-official-YYYY-MM-DD.json
├── merged-events/           # Processed data
│   ├── events.json          # Final merged events
│   ├── events-enhanced.json # With images
│   ├── events-summarized.json # With summaries
│   └── merge-report.json    # Merge statistics
├── pipeline-report.json     # Last run report
├── sanity-upload-report.json # Upload results
└── complete-pipeline-report.json # Full report

public/images/
├── eventimages/            # Downloaded event images
└── fallbacks/             # Generated placeholder images
```

## Event Data Schema

Each event follows this standardized format:

```json
{
  "id": "unique-identifier",
  "title": "Event Name",
  "slug": "event-name-slug",
  "description": "Event description...",
  "date": "2024-12-01T19:00:00.000Z",
  "endDate": "2024-12-01T22:00:00.000Z",
  "image": "/images/eventimages/event-image.jpg",
  "url": "https://event-website.com",
  "tickets": "https://ticket-website.com",
  "venue": {
    "name": "Venue Name",
    "address": "123 Main St",
    "city": "Sandpoint",
    "state": "ID"
  },
  "tags": ["Music", "Community", "Festival"],
  "source": "Eventbrite",
  "location": "Sandpoint, ID",
  "price": "$15",
  "scraped_at": "2024-01-15T10:30:00.000Z"
}
```

## Configuration Options

### Pipeline Options
- `runSandpointOnline`: Enable/disable Sandpoint Online scraping
- `runEventbrite`: Enable/disable Eventbrite scraping
- `runLocalVenues`: Enable/disable local venue scraping
- `runCityOfficial`: Enable/disable official sources
- `enhanceImages`: Download and process images
- `generateSummaries`: Create event descriptions
- `uploadToSanity`: Push to CMS

### Scraping Options
- `maxImageSize`: Maximum image file size (2MB default)
- `duplicateThresholds`: Similarity thresholds for deduplication
- `maxSummaryLength`: Character limit for descriptions

## Error Handling

The pipeline includes comprehensive error handling:

- **Individual Source Failures**: Other sources continue if one fails
- **Image Download Errors**: Fallback to placeholder images
- **API Rate Limits**: Automatic retry with backoff
- **Data Validation**: Invalid events are logged and skipped
- **Sanity Upload Issues**: Detailed error reporting

## Monitoring & Reports

### Pipeline Reports
- Execution time and status
- Events processed per source
- Duplicate detection results
- Error summaries with details
- Generated file locations

### Data Quality Metrics
- Source reliability scores
- Image availability rates
- Description completeness
- Venue data accuracy

## Scheduling

### Automated Runs
Set up automated pipeline runs using:

1. **Cron Jobs** (Linux/Mac)
```bash
# Run daily at 6 AM
0 6 * * * cd /path/to/sandpoint-events && npm run events:run
```

2. **Windows Task Scheduler**
3. **GitHub Actions** (if hosted on GitHub)
4. **Vercel Cron Jobs** (if deployed on Vercel)

### Recommended Schedule
- **Daily**: Light scraping (Sandpoint Online, City Official)
- **Weekly**: Full pipeline with all sources
- **Monthly**: Deep clean and optimization

## Advanced Usage

### Custom Source Addition
To add a new event source:

1. Create scraper in `scrapers/` directory
2. Extend `EventScraper` base class
3. Implement `scrapeEvents()` method
4. Add to `EventPipelineRunner`

### API Integration
For sources with APIs (like Eventbrite):

```javascript
const scraper = new EventbriteScraper();
const events = await scraper.scrapeEventbriteWithAPI(token, 'Sandpoint, ID');
```

### Filtering Events
```javascript
const filteredEvents = merger.filterEvents(events, {
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  location: 'Sandpoint',
  tags: ['Music', 'Festival']
});
```

## Troubleshooting

### Common Issues

1. **"No events found"**
   - Check internet connection
   - Verify source websites are accessible
   - Review scraper selectors (websites may have changed)

2. **"Sanity upload failed"**
   - Verify SANITY_TOKEN in environment
   - Check project ID and dataset name
   - Ensure proper Sanity permissions

3. **"Image download errors"**
   - Check disk space
   - Verify image URLs are accessible
   - Review firewall/proxy settings

4. **"Memory issues with Puppeteer"**
   - Increase Node.js memory: `node --max-old-space-size=4096`
   - Run sources individually instead of full pipeline

### Debug Mode
Enable verbose logging:
```bash
DEBUG=sandpoint-events* npm run events:run
```

### Manual Testing
Test individual scrapers:
```javascript
const SandpointScraper = require('./scrapers/sandpointOnlineScraper');
const scraper = new SandpointScraper();
const events = await scraper.scrapeEvents();
console.log(events);
```

## Contributing

### Adding New Sources
1. Study the website's event structure
2. Create new scraper extending `EventScraper`
3. Add comprehensive selectors and fallbacks
4. Include error handling and logging
5. Test with various event types
6. Update documentation

### Improving Existing Scrapers
- Monitor source website changes
- Add better selectors for edge cases
- Improve data extraction accuracy
- Handle new event formats

## Security Considerations

- **Rate Limiting**: Respect website rate limits
- **User Agents**: Use appropriate user agent strings
- **Data Privacy**: Only scrape publicly available events
- **API Keys**: Store securely in environment variables
- **Error Logging**: Don't log sensitive information

## Performance Optimization

- **Parallel Processing**: Scrape multiple sources simultaneously
- **Caching**: Cache venue data and images
- **Selective Updates**: Only process changed events
- **Image Optimization**: Resize and compress images
- **Database Indexing**: Ensure proper Sanity indexes

## Support

For issues and questions:

1. Check the generated reports in `data/` directory
2. Review error logs in console output
3. Test individual pipeline components
4. Verify configuration and environment variables
5. Check source website accessibility

## License

This pipeline is designed for the Sandpoint Events website. Modify and adapt as needed for your specific requirements.