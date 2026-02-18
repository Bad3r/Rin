import path from 'node:path'
import react from '@vitejs/plugin-react-swc'
import { codecovVitePlugin } from '@codecov/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  // Intentionally load only CODECOV_* keys for build-time plugin upload auth.
  // This token is consumed by Vite in Node at build time, not exposed at runtime.
  // In this monorepo, local secrets are typically kept at repo-root .env.local.
  const projectEnv = loadEnv(mode, process.cwd(), 'CODECOV_')
  const repoEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), 'CODECOV_')
  const codecovToken = projectEnv.CODECOV_TOKEN || repoEnv.CODECOV_TOKEN || process.env.CODECOV_TOKEN

  return {
    // Note: Client configuration is fetched from server at runtime
    // No environment variables are injected at build time
    build: {
      outDir: '../dist/client',
      emptyOutDir: true,
      chunkSizeWarningLimit: 2200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/mermaid/')) {
              return 'mermaid-vendor'
            }
            if (id.includes('/node_modules/cytoscape/')) {
              return 'cytoscape-vendor'
            }
            if (id.includes('/node_modules/monaco-editor/')) {
              return 'editor-vendor'
            }
            if (id.includes('/node_modules/katex/')) {
              return 'katex-vendor'
            }
            if (
              id.includes('/node_modules/@uiw/') ||
              id.includes('/node_modules/@codemirror/') ||
              id.includes('/node_modules/codemirror/') ||
              id.includes('/node_modules/react-markdown/') ||
              id.includes('/node_modules/remark-') ||
              id.includes('/node_modules/rehype-') ||
              id.includes('/node_modules/unified/')
            ) {
              return 'markdown-vendor'
            }
            return undefined
          },
        },
      },
    },
    plugins: [
      react(),
      // Only open visualizer in build mode
      visualizer({ open: !isDev }),
      // Keep Codecov plugin at the end of the plugin array.
      codecovVitePlugin({
        enableBundleAnalysis: Boolean(codecovToken),
        bundleName: 'rin-client',
        uploadToken: codecovToken,
      }),
    ],
    // Vitest configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      onConsoleLog(log, type) {
        if (type === 'stderr' && log.includes('Could not parse CSS stylesheet')) {
          return false
        }

        return undefined
      },
    },
  }
})
