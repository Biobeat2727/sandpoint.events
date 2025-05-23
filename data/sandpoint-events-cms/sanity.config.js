import { defineConfig } from 'sanity'
import { deskTool } from 'sanity/desk'
import { visionTool } from '@sanity/vision'
import schemas from './schemas'  // ⬅️ import all schemas from one place

export default defineConfig({
  name: 'default',
  title: 'Sandpoint Events CMS',
  projectId: '0i231ejv',   // Replace with yours
  dataset: 'production',
  plugins: [deskTool(), visionTool()],
  schema: {
    types: schemas,
  },
})
