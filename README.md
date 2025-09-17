# Sandpoint Events

A comprehensive event aggregation and display platform for Sandpoint, Idaho. This Next.js application automatically scrapes events from multiple sources, processes them through an intelligent pipeline, and displays them on a modern, responsive website.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Sanity CLI (for CMS)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd sandpoint-events
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Set up environment variables**
Create a `.env.local` file with:
```env
NEXT_PUBLIC_SANITY_PROJECT_ID=0i231ejv
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=your_sanity_token_here
```

4. **Start the development server**
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🔧 Event Processing Pipeline

### Current Architecture (Updated August 2025)

The system follows a streamlined **Raw Scraping → Event Merging → Normalization → Review Separation → Sanity Upload** pipeline with intelligent data quality controls.

### Available NPM Commands (Recommended)

#### Individual Steps
```bash
npm run scrape:sandpoint          # Scrape Sandpoint Online (paginated)
npm run scrape:schweitzer         # Scrape Schweitzer Mountain  
npm run scrape:eventbrite         # Scrape Eventbrite
npm run events:merge              # Merge scraped events
npm run events:upload             # Upload to Sanity (preview mode)
npm run events:upload:live        # Upload to Sanity (live upload)
```

#### Full Pipeline Options
```bash
npm run events:run                # Full pipeline (scrape + merge + upload)
npm run events:test               # Test mode pipeline
npm run scrape-all                # Legacy full scrape command
```

#### Utility Commands
```bash
npm run events:status             # Check pipeline status
npm run events:help               # Get help
npm run events:clean              # Clean up files
npm run events:enhance            # Enhance images
npm run events:summarize          # Generate summaries
```

### Alternative Direct Commands
```bash
# Individual scrapers
node scrapers/sandpointOnlineScraper.js
node scrapers/eventbriteScraper.js  
node scrapers/schweitzerScraper.js

# Event processing
node utils/eventMerger.js
node utils/realImageDownloader.js
node upload-events-to-sanity.js  # ✅ VERIFIED WORKING
```

**⚠️ Important**: Use `node upload-events-to-sanity.js` for uploads, NOT `node utils/sanityUploader.js` (that's a utility module).

### Intelligent Event Processing

#### Enhanced Event Schema
The system supports both legacy and enhanced fields:

**Core Fields:**
- `title`, `description`, `venue`, `tags`, `source`
- `startDate`, `endDate` - Specific event date ranges  
- `startTime`, `endTime` - Time strings in 24-hour format ("19:30")
- `referenceUrl` - Original source URL for attribution
- `needsReview` - Boolean flag for incomplete/ambiguous data
- `locationNote` - For ambiguous locations ("Downtown Sandpoint")

**Draft/Published System:**
- Events **with images** → `published: true` (appear on website)
- Events **without images** → `published: false` (saved as drafts)
- Image enhancement automatically promotes drafts to published

#### Data Quality Features

**Automatic Venue Enrichment:**
- Complete venue database with phone, website, address
- Automatic enrichment from known Sandpoint venues
- Proper venue object structure with all required fields

**Date/Time Validation:**
- Detects evening events with morning timestamps
- Catches default parsing errors (midnight with specific times)
- Flags events with description/time mismatches for review

**Duplicate Prevention:**
- Intelligent deduplication by event ID and date
- Allows recurring events on different dates
- Stable ID generation for consistent tracking

## 📊 Data Flow & File Structure

### Production Data Locations
- **Production Events**: `data/merged-events/events.json`
- **Review Events**: `data/events-to-review.json`
- **Upload Reports**: `sanity-upload-report.json`

### Key Processing Files
- **`utils/eventMerger.js`** - Main pipeline orchestrator, deduplication, venue enrichment
- **`utils/eventNormalizer.js`** - Schema normalization, data quality validation
- **`utils/intelligentTextParser.js`** - Converts unstructured text to complete JSON
- **`utils/sanityUploader.js`** - Upload utility module (imported by upload script)
- **`upload-events-to-sanity.js`** - Main upload script with detailed reporting

### Intelligent Review System

Events are automatically flagged for manual review when:
- ⚠️ Date/time mismatches detected (e.g., evening events with morning timestamps)
- ⚠️ Venue information is missing or incomplete
- ⚠️ Image download fails
- ⚠️ Event data structure is questionable
- ⚠️ Price extraction fails or returns invalid values

Flagged events go to `data/events-to-review.json` for manual verification before production.

## 🏗️ Development Structure

### Key Directories
- `components/` - React components (EventCard, EventDetail, Navbar, etc.)
- `pages/` - Next.js pages and API routes
- `scrapers/` - Event scrapers for different sources  
- `utils/` - Processing utilities (merger, normalizer, uploader, etc.)
- `data/` - Event data files and processing outputs
  - `data/merged-events/` - Production event files
  - `data/scraped-events/` - Raw scraped data with session tracking
  - `data/scraper-state/` - Pagination and session state
- `data/sandpoint-events-cms/` - Sanity CMS configuration

### Sanity CMS Setup

The CMS is located in `data/sandpoint-events-cms/`:
```bash
cd data/sandpoint-events-cms
npm install
npx sanity start
```

Visit http://localhost:3333 to access the Sanity Studio.

**Frontend Query for Published Events:**
```javascript
const query = '*[_type == "event" && published == true]'
```

## 🌐 Frontend Features

- **Event Discovery** - Browse upcoming events with filtering
- **Venue Pages** - Dedicated venue information and event listings
- **Event Details** - Comprehensive event information with images
- **Responsive Design** - Mobile-first, accessible interface with Tailwind CSS
- **Calendar Integration** - Add events to Google Calendar
- **Real-time Updates** - ISR (Incremental Static Regeneration)
- **Draft/Published System** - Clean separation of content states

## 📱 Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Event Pipeline
- `npm run events:run` - Complete pipeline automation
- `npm run events:merge` - Merge and process scraped events
- `npm run events:upload:live` - Upload to Sanity CMS
- `npm run scrape-all` - Legacy scraper command

## 🎯 Current System Status (August 2025)

✅ **Fully Operational Pipeline:**
- Enhanced venue parsing and price extraction
- Fixed date/time validation and mismatch detection
- Draft/published system for content quality
- Complete venue enrichment database
- Intelligent duplicate prevention
- Automated review workflow

✅ **24 Events Live in Sanity CMS**
- All recent uploads successful
- No duplicate events created
- Complete venue data for all events
- Draft/published logic working correctly

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.