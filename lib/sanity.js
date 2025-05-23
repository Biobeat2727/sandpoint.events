import { createClient } from '@sanity/client'

const client = createClient({
  projectId: '0i231ejv',   // Replace this!
  dataset: 'production',
  apiVersion: '2025-05-23', // Use current date or stable version
  useCdn: true,             // `false` if you need fresh draft data
})

export default client
