import react from '@vitejs/plugin-react-swc'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

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
    ],
    // Vitest configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: false,
      deps: {
        web: {
          transformCss: false,
        },
      },
      onConsoleLog(log, type) {
        if (type === 'stderr' && log.includes('Could not parse CSS stylesheet')) {
          return false
        }

        return undefined
      },
    },
  }
})
