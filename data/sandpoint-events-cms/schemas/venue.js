export default {
  name: 'venue',
  title: 'Venue',
  type: 'document',
  fields: [
    { name: 'name', title: 'Name', type: 'string' },
    { name: 'slug', title: 'Slug', type: 'slug', options: { source: 'name' } },
    { name: 'address', title: 'Address', type: 'string' },
    { name: 'image', title: 'Image', type: 'image', options: { hotspot: true } }
  ]
}
