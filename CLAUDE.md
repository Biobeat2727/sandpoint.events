# Sandpoint Events - Claude Context & Status

## 🎯 PROJECT GOALS & SYSTEM OVERVIEW

Transform the Sandpoint Events platform from manual event curation to an intelligent, automated scraping and processing pipeline that:
- Extracts events from multiple Sandpoint, ID sources
- Enforces data accuracy (no fabricated information)
- Separates incomplete events for human review
- Maintains high-quality event data for the live website

## 🚨 CRITICAL LESSON LEARNED - September 16, 2025

### Navbar CSS Specificity Issue - NEVER FORGET THIS
**Problem**: Mixing `hidden` with responsive classes like `md:flex` creates CSS specificity conflicts where the `hidden` class overrides the responsive behavior.

**Symptoms**:
- Navbar links disappearing on desktop even when screen is above breakpoint
- Elements not showing when they should based on screen size
- Responsive classes seemingly "not working"

**Root Cause**: CSS specificity conflict between base `hidden` class and responsive `md:flex`

**SOLUTION**: Use responsive classes for BOTH states:
```jsx
// ❌ WRONG - causes specificity conflicts
<div className="hidden md:flex">Desktop Nav</div>
<button className="md:hidden">Mobile Button</button>

// ✅ CORRECT - explicit responsive states
<div className="flex md:flex max-md:hidden">Desktop Nav</div>
<button className="flex md:hidden">Mobile Button</button>
```

**Debugging Method**: Add visible background colors to test what's actually showing:
```jsx
<div className="bg-red-500 p-2">Desktop Test</div>
<div className="bg-blue-500 p-2">Mobile Test</div>
```

**Time Cost**: This simple CSS issue cost 90 minutes of debugging when proper diagnosis would have taken 5 minutes.

**Key Takeaway**: Always diagnose with debug styles FIRST before guessing at breakpoints or browser window sizes.

## 🎯 CRITICAL STATUS UPDATE - August 8, 2025

### ✅ COMPLETED MAJOR FIXES
1. **Fixed venue parsing and price extraction issues** - Enhanced intelligentTextParser.js with better patterns
2. **Fixed "$undefined" and "$$5" price problems** - Removed global regex flags, added proper validation
3. **Fixed schema drift issues** - Created eventNormalizer.js for consistent data structure
4. **Enhanced date/time validation** - Added mismatch detection for events like "Movies on the Mountain" 
5. **Fixed missing URLs/venue data** - Enhanced EventMerger with venue enrichment (but removed URL generation to prevent hallucination)
6. **Removed URL generation logic** - **IMPORTANT**: DO NOT generate URLs that don't exist
7. **Added draft/published functionality** - Events without images upload as drafts (unpublished)

### 🏗️ CURRENT SYSTEM ARCHITECTURE

#### Enhanced Event Schema
Updated Sanity CMS with new fields:
- startDate, endDate - Specific event date ranges
- startTime, endTime - Time strings in 24-hour format ("19:30")
- referenceUrl - Original source URL for attribution
- needsReview - Boolean flag for incomplete/ambiguous data
- locationNote - For ambiguous locations ("Downtown Sandpoint")
- published - Draft/published status based on image availability

#### Core Data Pipeline
```
Raw Scraping → Event Merging → Normalization → Review Separation → Sanity Upload
```

#### Key Files & Their Purpose
- **`utils/eventMerger.js`** - Main pipeline orchestrator, deduplication, venue enrichment
- **`utils/eventNormalizer.js`** - Schema normalization, data quality validation, date/time mismatch detection  
- **`utils/intelligentTextParser.js`** - Intelligent Text Parser Subagent 🧠
  - Purpose: Convert unstructured event text into complete JSON
  - Capabilities: Extract times, parse venues, generate clean descriptions, infer tags/pricing/contact
  - Output: Complete Sanity-compatible JSON structure
- **`utils/sanityUploader.js`** - Upload to Sanity CMS with duplicate prevention and draft/published logic
- **`utils/realImageDownloader.js`** - Downloads real event images, flags events as needsReview if images fail
- **`utils/formatDate.js`** - Enhanced date/time formatting utilities  
- **`scripts/cli.js`** - Command line interface for all operations

#### CLI Commands (Direct)
```bash
# Merge scraped events and apply all fixes
node scripts/cli.js merge

# Upload to Sanity (loads from .env.local)
node scripts/cli.js upload

# Preview upload without actually uploading
node scripts/cli.js upload --preview

# Full pipeline (scrape + merge + upload) - NOTE: HAS BUGS, USE NPM INSTEAD
node scripts/cli.js run
```

#### NPM Commands (RECOMMENDED - These Work Better)
```bash
# Individual Scrapers
npm run scrape:sandpoint          # 🔥 NEW PAGINATED VERSION (10 events per run, 177+ total found)
npm run scrape:schweitzer         # ✅ NEW HYBRID - JSON-LD + HTML parsing
npm run scrape:eventbrite         # ✅ ENHANCED - JSON-LD priority with HTML fallback
npm run scrape:local-venues       # Local venue event scraping

# Processing Steps  
npm run events:merge              # Merge scraped events + deduplication
npm run events:upload             # Upload to Sanity (preview mode)
npm run events:upload:live        # Upload to Sanity (live production)

# Full Pipeline Options
npm run events:run                # Full pipeline (scrape + merge + upload)
npm run events:test               # Test mode pipeline
npm run scrape-all                # Legacy full scrape command

# Utility Commands
npm run events:status             # Check pipeline status
npm run events:help               # Get help
npm run events:clean              # Clean up files
npm run events:enhance            # Enhance images
npm run events:summarize          # Generate summaries
```

#### Streamlined Workflow (NEW - August 8, 2025)
```bash
# SINGLE COMMAND - Complete pipeline per source
npm run scrape:sandpoint          # Scrape → Merge → Upload → Archive
npm run scrape:eventbrite         # Complete Eventbrite pipeline  
npm run scrape:schweitzer         # Complete Schweitzer pipeline

# Check current status
npm run events:status             # Shows active data and progress
```

#### Legacy Workflow (Still Supported)
```bash
# Manual step-by-step process
npm run events:merge              # Merge existing scraped data
npm run events:upload:live        # Upload to Sanity
npm run events:enhance            # Add images to drafts
```

#### Scraper Management  
```bash
# Resume pagination from last position
npm run scrape:sandpoint

# Reset and start over  
npm run scrape:sandpoint -- --reset

# Custom batch size
npm run scrape:sandpoint -- --max-events=5

# Check current pagination state
cat data/scraper-state/sandpoint-online-state.json
```

### 🔧 CURRENT DATA STRUCTURE (PRODUCTION READY)

#### Production Events Location: `data/merged-events/events.json`
#### Review Events Location: `data/events-to-review.json`

#### Sample Production Event Structure:
```json
{
  "id": "stable-fc073876",
  "title": "Summer Theater Camp The Three Musketeers",
  "slug": "summer-theater-camp-three-musketeers", 
  "date": "2025-08-08T18:00:00.000Z",
  "startDate": "2025-08-08T18:00:00.000Z",
  "description": "Student performance featuring talented actors ages 8-17...",
  "venue": {
    "name": "Panida Theater",
    "address": "300 N 1st Ave, Sandpoint, ID 83864",
    "city": "Sandpoint",
    "state": "ID", 
    "zipCode": "83864",
    "phone": "(208) 263-9191",
    "website": "https://www.panida.org"
  },
  "tags": ["family", "performance", "theater", "youth"],
  "url": null,  // DO NOT GENERATE - only preserve legitimate URLs
  "imageUrl": null,  // DO NOT GENERATE - only preserve verified URLs
  "published": true,  // Events with images = published, without images = draft
  "source": "Sandpoint Online",
  "referenceUrl": "https://sandpointonline.com/current/index.shtml",
  "needsReview": false
}
```

### 📊 STATE MANAGEMENT & PAGINATION

#### SandpointOnline Pagination State
**File**: `data/scraper-state/sandpoint-online-state.json`
```json
{
  "lastProcessedIndex": 10,
  "currentPage": 2, 
  "eventsPerPage": 10,
  "totalEventsFound": 177,
  "isComplete": false
}
```

#### Progress Reporting Example
```
📊 Total progress: 10/177 events (6% complete)
🎯 Events ready for production: 3
⚠️  Events needing review: 7  
💾 Next run starts from index 10
```

### 🛡️ ACCURACY ENFORCEMENT SYSTEM

#### No Data Fabrication Policy
- Never guess missing information
- Set `needsReview: true` for incomplete data
- Only complete, verified events go to production

#### Review Triggers
Events are flagged for review when:
- ⚠️ Time information missing
- ⚠️ Venue/location ambiguous  
- ⚠️ Image download fails
- ⚠️ Performer info missing (for concerts)
- ⚠️ Event structure questionable

### 🚨 CRITICAL ISSUES RESOLVED

#### Date/Time Mismatch Detection (Enhanced eventNormalizer.js:320-377)
**Problem**: Events like "Movies on the Mountain" showed 12:30 PM (19:30 UTC) but described evening events "under the stars"
**Solution**: Enhanced validation catches:
- Evening startTime with morning timestamps
- Events with evening description clues but daytime timestamps  
- Default parsing errors (midnight with specific times)

#### Venue Data Enrichment (eventMerger.js:560-690)
**Working Features**:
- Complete venue database with phone, website, address for all major Sandpoint venues
- Automatic venue enrichment from known database
- Proper venue object structure with all required fields

**DO NOT TOUCH**: The venue enrichment is working perfectly - don't modify this system.

#### URL Handling (eventMerger.js:518-519)
**CRITICAL**: Removed URL generation to prevent hallucinating non-existent URLs
```javascript
// Do NOT generate URLs - only preserve legitimate ones that exist
// URLs should only come from actual scraped data, not be generated
```

### 📊 CURRENT STATUS (Last Merge)
- **Production Events**: 7 events ready for Sanity upload
- **Review Events**: 12 events flagged for manual review
- **Date Range**: August 8, 2025 - September 4, 2025
- **Sources**: Sandpoint Online, Schweitzer Mountain Resort
- **Field Completeness**: startDate 100%, referenceUrl 100%, venues enriched

### 🔐 SANITY CONFIGURATION & DRAFT/PUBLISHED SYSTEM

#### Environment File: `.env.local` (EXISTS AND CONFIGURED)
```env
SANITY_PROJECT_ID=0i231ejv
SANITY_DATASET=production  
SANITY_API_VERSION=2025-05-23
SANITY_TOKEN=skAKenqTGgyV050pizZcFNpvazEljX19ZV4tmbGl6S0Pc2mwOmRtrWwRztCzXX998atdRPyaFbNtsNawazTvDmXVoo6RPxJdLLeJqDv7qyXkTFWTAxevH3xOhhttMRsC0YGRDcgsmD4VrW60IyPPBgc9noaDYiaXNrioCohNwv0q8Ax8XASG
```

#### Draft/Published Logic (NEW FEATURE)
**How it works:**
- Events **with images** → `published: true` (appear on website)
- Events **without images** → `published: false` (saved as drafts)
- **Image enhancement** → Automatically promotes drafts to published

**Frontend Query for Published Events:**
```javascript
const query = '*[_type == "event" && published == true]'
```

#### Upload Command (VERIFIED WORKING ✅)
```bash
node upload-events-to-sanity.js
```

**NOTE**: Do NOT use `node utils/sanityUploader.js` - this is a utility module, not the upload script.

### ⚠️ DANGER ZONES - DO NOT MODIFY

#### 1. intelligentTextParser.js Venue Database (utils/intelligentTextParser.js:15-45)
This is working perfectly for venue recognition. DO NOT modify the venue patterns or known venues database.

#### 2. eventMerger.js Venue Enrichment (utils/eventMerger.js:560-690) 
The `enrichVenueData()` method provides complete venue information. This system works - don't touch it.

#### 3. URL Generation Logic (REMOVED)
DO NOT add URL generation back. Only preserve URLs that actually exist from scraped data.

#### 4. Draft/Published Logic (utils/sanityUploader.js:125-173)
The published field logic works correctly. Events start as drafts and get promoted when images are added.

### 🚀 NEXT IMMEDIATE STEPS

1. **Upload current production events to Sanity:**
   ```bash
   node upload-events-to-sanity.js
   ```

2. **Review flagged events** in `data/events-to-review.json` - these need manual review for:
   - Date/time mismatches (Movies on the Mountain timing issues)
   - Missing venue information  
   - Garbled text or parsing issues

3. **Monitor draft events** - Events without images will be saved as drafts in Sanity

4. **Enhance images** - Use image enhancement tools to add images to draft events (promotes them to published)

5. **Monitor data quality** - The enhanced validation now catches most issues automatically

### 🧠 CONTEXT PRESERVATION NOTES

#### What Works (Don't Break):
- Venue parsing and enrichment system
- Date/time mismatch validation  
- Event normalization and schema consistency
- Duplicate detection and stable ID generation
- Review workflow separation
- Draft/published logic for events without images

#### What Was Fixed (Don't Revert):
- Price extraction (removed global regex flags)
- Venue name parsing (enhanced patterns)
- Schema drift (scraped_at → scrapedAt normalization)
- URL handling (removed hallucinated URL generation)
- Draft/published system (events without images saved as drafts)

#### Key Learning:
The system was working well before context compression. The main lesson is to preserve working systems and only make targeted fixes rather than broad changes that could break functioning components.

### 📁 STREAMLINED FILE STRUCTURE (Updated August 8, 2025)
```
C:\Users\davey\sandpoint-events\
├── .env.local (Sanity configuration)
├── data/
│   ├── active/                    ← NEW: Single source of truth
│   │   ├── sandpoint-online.json       (accumulating scraped events)
│   │   ├── eventbrite.json             (current eventbrite events)
│   │   └── schweitzer.json             (current schweitzer events)
│   ├── archive/                   ← NEW: Historical sessions  
│   │   └── 2025-08-08/                 (previous runs archived here)
│   ├── merged-events/
│   │   ├── events.json                 (production events)
│   │   └── merge-report.json
│   ├── events-to-review.json           (review events)
│   └── scraper-state/
│       └── sandpoint-online-state.json (pagination state)
├── utils/
│   ├── eventMerger.js (Main pipeline + venue enrichment)
│   ├── eventNormalizer.js (Data quality + validation) 
│   ├── intelligentTextParser.js (Smart text parsing subagent)
│   ├── realImageDownloader.js (Image enhancement)
│   ├── formatDate.js (Date/time utilities)
│   └── sanityUploader.js (Upload to CMS)
├── scrapers/
│   ├── sandpointOnlineScraper.js (Paginated scraper)
│   ├── eventbriteScraper.js (JSON-LD enhanced)
│   ├── schweitzerScraper.js (Hybrid approach)
│   └── localVenueScraper.js (Local venues)
└── scripts/
    └── cli.js (Command interface)
```

### 🚀 ARCHITECTURE IMPROVEMENTS (August 8, 2025)

#### Consolidation Pattern Benefits
- **Single source of truth**: Merger reads from `data/active/*.json` only
- **Automatic cleanup**: Completed sessions moved to `data/archive/[date]/`  
- **Preserved intelligence**: All parsing, review, and quality systems intact
- **One-command operation**: `npm run scrape:sandpoint` does everything
- **Eliminated file chaos**: No more scattered scraped-events files

### 📋 KEY FILES CREATED/UPDATED

#### New Files Added
- **`utils/intelligentTextParser.js`** - Smart text parsing subagent
- **`data/scraper-state/sandpoint-online-state.json`** - Pagination state tracking
- **`scrapers/schweitzerScraper.js`** - New hybrid scraper  
- **`utils/formatDate.js`** - Enhanced date/time formatting utilities

#### Major File Updates
- **`scrapers/sandpointOnlineScraper.js`** - Complete rewrite with pagination
- **`scrapers/eventbriteScraper.js`** - Enhanced with JSON-LD priority
- **`utils/eventMerger.js`** - New schema support + needsReview handling
- **`utils/realImageDownloader.js`** - Review flag integration
- **`data/sandpoint-events-cms/schemas/event.js`** - New schema fields
- **All frontend components** - New schema field support

**Last Updated**: August 8, 2025 - All major parsing and data quality issues resolved, draft/published system implemented, ready for Sanity upload

### 📋 RECENT ADDITIONS (August 8, 2025)

#### Draft/Published System Implementation
- **Modified `utils/sanityUploader.js`** with published field logic
- Events without images automatically saved as drafts (`published: false`)
- Events with images automatically published (`published: true`) 
- Image enhancement process promotes drafts to published automatically
- Frontend should query `*[_type == "event" && published == true]` for live events
- Preview mode shows which events will be published vs saved as drafts

#### Benefits:
- No unprofessional events without images appear on website
- Events are safely stored in Sanity for later enhancement
- Automatic promotion when images are added
- Clean separation between draft and live content

