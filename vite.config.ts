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
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // sharp utilise des binaires natifs — ne pas bundler dans les fonctions Vercel
    ssr: {
      external: ['sharp'],
    },
    environments: {
      vercel_node: {
        build: {
          rollupOptions: {
            external: ['sharp', /^@img\/sharp-/],
          },
        },
      },
    },
  }
})
