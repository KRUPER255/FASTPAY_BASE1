import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

// Plugin to ensure react-vendor loads BEFORE the main entry script
// This ensures React is available before any code that uses it
function fixChunkOrder() {
  return {
    name: 'fix-chunk-order',
    writeBundle(options: { dir?: string }) {
      if (options.dir) {
        const htmlPath = path.join(options.dir, 'index.html')
        try {
          let html = readFileSync(htmlPath, 'utf-8')
          
          // Extract react-vendor modulepreload
          const reactVendorRegex = /<link rel="modulepreload"[^>]+react-vendor[^>]+>/g
          const reactVendorPreloads = html.match(reactVendorRegex) || []
          
          // Extract react-vendor script path
          const reactVendorScriptMatch = reactVendorPreloads[0]?.match(/href="([^"]+)"/)
          const reactVendorPath = reactVendorScriptMatch ? reactVendorScriptMatch[1] : null
          
          // Extract other modulepreload links (excluding react-vendor)
          const otherPreloadRegex = /<link rel="modulepreload"[^>]+(?!react-vendor)[^>]+>/g
          const otherPreloads = html.match(otherPreloadRegex) || []
          
          // Find the main entry script
          const scriptRegex = /<script[^>]+src="[^"]*index-[^"]+\.js"[^>]*>/
          const scriptMatch = html.match(scriptRegex)
          
          if (scriptMatch && scriptMatch.index !== undefined && reactVendorPreloads.length > 0 && reactVendorPath) {
            // Remove all existing preloads
            html = html.replace(/<link rel="modulepreload"[^>]+>/g, '')
            
            // Insert react-vendor as a SCRIPT tag FIRST (loads before main entry)
            // This ensures React is loaded before any ES modules execute
            const insertPos = scriptMatch.index
            const beforeScript = html.substring(0, insertPos).trimEnd()
            const afterScript = html.substring(insertPos)
            
            // Load react-vendor as a module script FIRST, then other preloads, then main script
            // The import in the main script will wait for react-vendor to load
            const reactVendorScript = `<script type="module" src="${reactVendorPath}"></script>`
            html = beforeScript + '\n    ' + reactVendorScript + '\n    ' + otherPreloads.join('\n    ') + '\n    ' + afterScript
          } else if (scriptMatch && scriptMatch.index !== undefined && reactVendorPreloads.length > 0) {
            // Fallback: just reorder preloads
            html = html.replace(/<link rel="modulepreload"[^>]+>/g, '')
            const insertPos = scriptMatch.index
            const beforeScript = html.substring(0, insertPos).trimEnd()
            const afterScript = html.substring(insertPos)
            const allPreloads = [...reactVendorPreloads, ...otherPreloads]
            html = beforeScript + '\n    ' + allPreloads.join('\n    ') + '\n    ' + afterScript
          }
          
          writeFileSync(htmlPath, html, 'utf-8')
        } catch (e) {
          console.warn('Could not fix chunk order:', e)
        }
      }
    },
  }
}

// Get auth token from environment variable (for dev proxy)
const BLACKSMS_AUTH_TOKEN = process.env.VITE_BLACKSMS_AUTH_TOKEN || ''

// Get base path from environment variable
// Production: / (root) -> https://fastpaygaming.com/
// Test/Local: /test/ -> https://fastpaygaming.com/test/
// Default: / (root) for production, / for dev (dev server handles routing)
const BASE_PATH = process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), fixChunkOrder()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Production optimizations
    minify: 'esbuild',  // Fast and efficient minification
    cssMinify: true,
    sourcemap: false,  // Disable sourcemaps in production for smaller builds
    target: 'es2022',  // Target modern browsers (supports top-level await)
    // Chunk size optimization
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB per chunk
    reportCompressedSize: true,  // Report compressed size
    rollupOptions: {
      output: {
        // Ensure proper chunk loading order by making react-vendor a dependency
        entryFileNames: 'assets/[name]-[hash].js',
        // Optimize chunk file names for better caching
        chunkFileNames: (chunkInfo) => {
          // Ensure react-vendor loads first
          if (chunkInfo.name === 'react-vendor') {
            return 'assets/react-vendor-[hash].js'
          }
          return 'assets/[name]-[hash].js'
        },
        assetFileNames: (assetInfo) => {
          // Optimize asset file names
          if (!assetInfo.name) return 'assets/[name]-[hash][extname]'
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        // Ensure chunks that depend on react-vendor are loaded after it
        manualChunks(id) {
          // React core - must be first to ensure it's available
          // Include ALL react-related packages here
          // CRITICAL: All React packages must be in react-vendor to ensure React is available
          // This includes react, react-dom, and ALL packages that start with react-
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/react-router-dom')) {
            return 'react-vendor'
          }
          // Catch all other react- packages
          if (id.includes('node_modules/react-')) {
            return 'react-vendor'
          }
          // Chart.js
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'chart-vendor'
          }
          // Firebase (all firebase modules)
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor'
          }
          // Rich text editor
          if (id.includes('node_modules/react-quill')) {
            return 'editor-vendor'
          }
          // Animation library
          if (id.includes('node_modules/framer-motion')) {
            return 'animation-vendor'
          }
          // Radix UI components - these depend on React, so keep them separate
          if (id.includes('node_modules/@radix-ui')) {
            return 'ui-vendor'
          }
          // Packages that use React at module evaluation time (forwardRef, hooks at top level)
          // MUST be in react-vendor to ensure React is available
          // Catch ALL @floating-ui packages (including react-dom variant)
          if (id.includes('node_modules/@floating-ui')) {
            return 'react-vendor'
          }
          // These packages use React hooks at module evaluation time
          if (id.includes('node_modules/react-style-singleton') ||
              id.includes('node_modules/use-sidecar') ||
              id.includes('node_modules/react-remove-scroll') ||
              id.includes('node_modules/react-remove-scroll-bar') ||
              id.includes('node_modules/scheduler') ||
              id.includes('node_modules/react-remove-scroll/package') ||
              id.includes('node_modules/use-sidecar/package')) {
            return 'react-vendor'
          }
          // lucide-react uses React.forwardRef at module evaluation time - MUST be in react-vendor
          if (id.includes('node_modules/lucide-react')) {
            return 'react-vendor'
          }
          // React-dependent packages that only use React in functions (not at module level)
          // Can be in utils-vendor since they don't execute React code at module evaluation
          if (id.includes('node_modules/class-variance-authority') || 
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/@sentry/react') ||
              id.includes('node_modules/@sentry/tracing') ||
              id.includes('node_modules/react-refresh') ||
              id.includes('node_modules/react-is') ||
              id.includes('node_modules/fast-deep-equal') ||
              id.includes('node_modules/fflate')) {
            return 'utils-vendor'
          }
          // @floating-ui/dom (non-React version) can be separate
          if (id.includes('node_modules/@floating-ui/dom')) {
            return 'utils-vendor'
          }
          // Non-React utilities
          if (id.includes('node_modules/date-fns') || 
              id.includes('node_modules/dompurify') || 
              id.includes('node_modules/isomorphic-dompurify') ||
              id.includes('node_modules/xlsx') ||
              id.includes('node_modules/zod')) {
            return 'utils-vendor'
          }
          // Keep UI components with main bundle to ensure React is available
          // Don't chunk UI components separately - they need React from react-vendor
          if (id.includes('/component/ui/')) {
            return undefined
          }
          // CRITICAL: Only put truly non-React packages in vendor chunk
          // If ANY package imports or uses React, it MUST NOT be in vendor chunk
          // The vendor chunk should ONLY contain packages with ZERO React dependencies
          if (id.includes('node_modules')) {
            // Comprehensive list of React-dependent patterns - be VERY aggressive
            // If it uses React at module level (hooks, forwardRef), it MUST be in react-vendor
            const reactModuleLevelPatterns = [
              'react', '@radix-ui', 'framer-motion', 'react-chartjs', 
              'react-quill', 'react-router', 'lucide-react', 'sentry',
              '@floating-ui', 'react-style-singleton', 'react-refresh',
              'react-is', '@sentry', 'react-dom', 'react-', 'use-sidecar',
              'react-remove-scroll', 'scheduler'
            ]
            const isReactModuleLevel = reactModuleLevelPatterns.some(pattern => id.includes(pattern))
            
            if (isReactModuleLevel) {
              // If it uses React at module level, put it in react-vendor
              return 'react-vendor'
            }
            
            // Packages that depend on React but only use it in functions
            const reactFunctionLevelPatterns = ['fflate']
            const isReactFunctionLevel = reactFunctionLevelPatterns.some(pattern => id.includes(pattern))
            
            if (isReactFunctionLevel) {
              // Can be in utils-vendor since they don't execute React code at module evaluation
              return 'utils-vendor'
            }
            
            // Only put packages we KNOW don't use React in vendor
            const safeNonReactPackages = [
              'express', 'cors', 'date-fns', 'dompurify', 'xlsx', 'zod',
              'chart.js', 'tailwindcss', 'autoprefixer', 'postcss'
            ]
            const isSafePackage = safeNonReactPackages.some(pkg => id.includes(`node_modules/${pkg}`))
            
            if (isSafePackage) {
              return 'vendor'
            }
            
            // When in doubt, put it in react-vendor to be safe (ensures React is available)
            return 'react-vendor'
          }
        },
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0', // Allow external access
    port: 5173,
    proxy: {
      '/api/send-sms': {
        target: 'https://blacksms.in',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/send-sms/, '/sms'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Add Authorization header from environment variable
            if (BLACKSMS_AUTH_TOKEN) {
              proxyReq.setHeader('Authorization', BLACKSMS_AUTH_TOKEN)
            } else {
              console.warn('⚠️  VITE_BLACKSMS_AUTH_TOKEN not set - proxy may fail')
            }
          })
        },
      },
      '/api/send-whatsapp': {
        target: 'https://blacksms.in',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/send-whatsapp/, '/whatsapp'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Add Authorization header from environment variable
            if (BLACKSMS_AUTH_TOKEN) {
              proxyReq.setHeader('Authorization', BLACKSMS_AUTH_TOKEN)
            } else {
              console.warn('⚠️  VITE_BLACKSMS_AUTH_TOKEN not set - proxy may fail')
            }
          })
        },
      },
      '/api/phone-data': {
        target: 'http://18.162.131.251',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/phone-data/, '/BswFiops1221cfddaaaawsdYTA/phone'),
      },
    },
  },
})
