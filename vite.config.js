import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    base: env.VITE_BUILD_BASE || './',
    manifest: true,

    resolve: {
      alias: {
        '@': resolve(__dirname, './src')
      }
    },
    optimizeDeps: {
      exclude: []
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:36530',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  }
})
