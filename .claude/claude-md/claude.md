Sandpoint Events Scraper System - Implementation Summary

  🎯 Project Goals

  Transform the Sandpoint Events platform from manual event curation to an intelligent, automated scraping and
  processing pipeline that:
  - Extracts events from multiple Sandpoint, ID sources
  - Enforces data accuracy (no fabricated information)
  - Separates incomplete events for human review
  - Maintains high-quality event data for the live website

  🏗️ System Architecture Implemented

  Enhanced Event Schema

  Updated Sanity CMS with new fields:
  - startDate, endDate - Specific event date ranges
  - startTime, endTime - Time strings in 24-hour format ("19:30")
  - referenceUrl - Original source URL for attribution
  - needsReview - Boolean flag for incomplete/ambiguous data
  - locationNote - For ambiguous locations ("Downtown Sandpoint")

  Multi-Source Scraping Pipeline

  1. SandpointOnline Scraper 🔥 NEW PAGINATED VERSION

  - Source: https://sandpointonline.com/current/index.shtml
  - Method: Intelligent paragraph text parsing
  - Features:
    - Pagination (10 events per run)
    - State tracking (data/scraper-state/sandpoint-online-state.json)
    - Intelligent text parser integration
    - Progress reporting (found 177+ events)
  - CLI: npm run scrape:sandpoint [--reset] [--max-events=N]

  2. Eventbrite Scraper ✅ ENHANCED

  - Method: JSON-LD structured data priority with HTML fallback
  - Features: Proper schema field extraction, accuracy enforcement

  3. Schweitzer Scraper ✅ NEW HYBRID

  - Source: https://schweitzer.com events
  - Method: Hybrid JSON-LD + HTML parsing
  - Features: Mountain resort specific event handling

  Intelligent Text Parser Subagent 🧠 NEW

  - File: utils/intelligentTextParser.js
  - Purpose: Convert unstructured event text into complete JSON
  - Capabilities:
    - Extract times: "Start at 7:30 p.m." → startTime: "19:30"
    - Parse venues: "Schweitzer" → full venue object
    - Generate clean descriptions (removes metadata)
    - Infer tags, pricing, contact info
    - Output complete Sanity-compatible JSON structure

  🔄 Data Processing Pipeline

  Step 1: Scraping

  # Individual scrapers
  npm run scrape:sandpoint    # Paginated, intelligent parsing
  npm run scrape:eventbrite   # JSON-LD priority
  npm run scrape:schweitzer   # Hybrid approach

  # Complete pipeline
  npm run scrape-all

  Step 2: Event Merging

  node utils/eventMerger.js
  Output:
  - data/merged-events/events.json - Production ready events
  - data/events-to-review.json - Events needing human review

  Step 3: Image Enhancement

  node utils/realImageDownloader.js
  Downloads real event images, flags events as needsReview: true if images fail

  Step 4: CMS Upload

  node utils/sanityUploader.js
  Uploads only production-ready events (not flagged for review)

  🛡️ Accuracy Enforcement System

  No Data Fabrication Policy

  - Never guess missing information
  - Set needsReview: true for incomplete data
  - Only complete, verified events go to production

  Review Triggers

  Events are flagged for review when:
  - ⚠️ Time information missing
  - ⚠️ Venue/location ambiguous
  - ⚠️ Image download fails
  - ⚠️ Performer info missing (for concerts)
  - ⚠️ Event structure questionable

  🖥️ Frontend Updates

  Enhanced Components

  - EventCard.jsx: Date ranges, time ranges, location notes, reference URLs
  - EventDetailPage.jsx: Comprehensive event information display
  - VenueDetailPage.jsx: Enhanced venue event listings
  - New formatting utilities: Date/time display functions

  Display Features

  - Date ranges: "August 10–12, 2025"
  - Time ranges: "2:00 PM – 4:00 PM"
  - Location handling: Venue name OR "Location: Downtown Sandpoint"
  - Reference links: "View Original Event" buttons

  📊 State Management & Pagination

  SandpointOnline State Tracking

  File: data/scraper-state/sandpoint-online-state.json
  {
    "lastProcessedIndex": 10,
    "currentPage": 2,
    "eventsPerPage": 10,
    "totalEventsFound": 177,
    "isComplete": false
  }

  Progress Reporting

  📊 Total progress: 10/177 events (6% complete)
  🎯 Events ready for production: 3
  ⚠️  Events needing review: 7
  💾 Next run starts from index 10

  🎮 How to Use the System

  Daily Event Scraping Workflow

  # 1. Scrape events in batches
  npm run scrape:sandpoint          # Get next 10 events
  npm run scrape:eventbrite         # All eventbrite events
  npm run scrape:schweitzer         # All schweitzer events

  # 2. Process and merge all scraped events
  node utils/eventMerger.js

  # 3. Download real images
  node utils/realImageDownloader.js

  # 4. Review flagged events manually
  cat data/events-to-review.json    # Edit as needed

  # 5. Upload production events to Sanity
  node utils/sanityUploader.js

  Scraper Management

  # Resume pagination
  npm run scrape:sandpoint

  # Reset and start over
  npm run scrape:sandpoint -- --reset

  # Custom batch size
  npm run scrape:sandpoint -- --max-events=5

  # Check current state
  cat data/scraper-state/sandpoint-online-state.json

  📁 Key Files Created/Updated

  New Files

  - utils/intelligentTextParser.js - Smart text parsing subagent
  - data/scraper-state/sandpoint-online-state.json - Pagination state
  - scrapers/schweitzerScraper.js - New hybrid scraper
  - utils/formatDate.js - Enhanced date/time formatting utilities

  Updated Files

  - scrapers/sandpointOnlineScraper.js - Complete rewrite with pagination
  - scrapers/eventbriteScraper.js - Enhanced with JSON-LD priority
  - utils/eventMerger.js - New schema support + needsReview handling
  - utils/realImageDownloader.js - Review flag integration
  - data/sandpoint-events-cms/schemas/event.js - New schema fields
  - All frontend components - New schema field support
  - package.json - New npm scripts
  - README.md - Complete documentation

  🎯 Current Status

  Completed ✅

  - All 10 major implementation tasks completed
  - Intelligent text parser with full JSON output
  - Paginated SandpointOnline scraper (177+ events found)
  - Complete accuracy enforcement system
  - Frontend component updates
  - Enhanced event schema
  - State management and progress tracking

  Ready for Production 🚀

  The system is fully operational and ready for daily event processing. The paginated scraper allows manageable
  processing of large event datasets while maintaining data quality and providing intelligent automation.