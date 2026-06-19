import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from 'vite-plugin-vercel/vite'
import { getVercelEntries } from 'vite-plugin-vercel'
import path from 'path'

export default defineConfig(async () => {
  const entries = await getVercelEntries('api', {
    destination: 'api',
  })

  return {
    plugins: [
      react(),
      vercel({
        entries,
        defaultMaxDuration: 60,
        rewrites: [
          { source: '/((?!api/).*)', destination: '/index.html' }
        ],
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
