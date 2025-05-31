import { validation } from "sanity";

export default {
  name: 'event',
  title: 'Event',
  type: 'document',
  fields: [
    { name: 'title', title: 'Title', type: 'string' },
    { name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } },
    { name: 'date', title: 'Date', type: 'datetime' },
    { name: 'description', title: 'Description', type: 'text' },
    { name: 'image', title: 'Image', type: 'image', options: { hotspot: true } },
    { name: 'tags', title: 'tags', type: 'array', of: [{ type: 'string'}], options: { layout: 'tags', list: ['Music', 'Food', 'Community', 'Outdoors', 'Art', 'Festival', 'Live', 'Fundraiser']},},
    { name: 'url', title: 'Event Website URL', type: 'url', validation: (Rule) => Rule.uri({ scheme: ['http', 'https'],}),},
    { name: 'tickets', title: 'Event Tickets URL', type: 'url', validation: (Rule) => Rule.uri({ scheme: [ 'http', 'https'],}),},
    {
      name: 'venue',
      title: 'Venue',
      type: 'reference',
      to: [{ type: 'venue' }]
    }
  ]
}
