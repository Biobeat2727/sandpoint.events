import { validation } from "sanity";

export default {
  name: 'event',
  title: 'Event',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'string' },
    { name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } },
    { 
      name: 'date', 
      title: 'Date (Legacy)', 
      type: 'datetime',
      description: 'Legacy field - use startDate instead'
    },
    {
      name: 'startDate',
      title: 'Start Date',
      type: 'datetime',
      description: 'Event start date and time'
    },
    {
      name: 'endDate', 
      title: 'End Date',
      type: 'datetime',
      description: 'Event end date and time (optional)',
      validation: Rule => Rule.optional()
    },
    {
      name: 'startTime',
      title: 'Start Time',
      type: 'string',
      description: 'Start time in 24-hour format (e.g., "14:00")',
      validation: Rule => Rule.optional().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        name: 'time format',
        invert: false
      })
    },
    {
      name: 'endTime',
      title: 'End Time', 
      type: 'string',
      description: 'End time in 24-hour format (e.g., "16:00")',
      validation: Rule => Rule.optional().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        name: 'time format',
        invert: false
      })
    },
    { name: 'description', title: 'Description', type: 'text' },
    { name: 'image', title: 'Image', type: 'image', options: { hotspot: true } },
    { name: 'tags', title: 'tags', type: 'array', of: [{ type: 'string'}], options: { layout: 'tags', list: ['Music', 'Food', 'Community', 'Outdoors', 'Art', 'Festival', 'Live', 'Fundraiser']},},
    { name: 'url', title: 'Event Website URL', type: 'url', validation: (Rule) => Rule.uri({ scheme: ['http', 'https'],}),},
    { name: 'tickets', title: 'Event Tickets URL', type: 'url', validation: (Rule) => Rule.uri({ scheme: [ 'http', 'https'],}),},
    {
      name: 'referenceUrl',
      title: 'Reference URL',
      type: 'url',
      description: 'URL to the original event listing or source page',
      validation: (Rule) => Rule.uri({ scheme: ['http', 'https'] })
    },
    {
      name: 'needsReview',
      title: 'Needs Review',
      type: 'boolean',
      description: 'Flag for events with incomplete or ambiguous data that need manual review',
      initialValue: false
    },
    {
      name: 'locationNote',
      title: 'Location Note',
      type: 'string',
      description: 'Additional location information for ambiguous or non-specific venues (e.g., "Downtown Sandpoint")',
      validation: Rule => Rule.optional()
    },
    {
      name: 'venue',
      title: 'Venue',
      type: 'reference',
      to: [{ type: 'venue' }],
      description: 'Specific venue reference (leave empty if location is ambiguous and use locationNote instead)'
    }
  ],
  preview: {
    select: {
      title: 'title',
      startDate: 'startDate',
      date: 'date',
      media: 'image',
      needsReview: 'needsReview'
    },
    prepare(selection) {
      const { title, startDate, date, needsReview } = selection;
      const eventDate = startDate || date;
      const reviewFlag = needsReview ? '⚠️ ' : '';
      
      return {
        title: `${reviewFlag}${title}`,
        subtitle: eventDate ? new Date(eventDate).toLocaleDateString() : 'No date set'
      }
    }
  }
}
