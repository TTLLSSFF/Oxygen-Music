import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.QQ_MUSIC_API_PORT || env.API_PORT || 3200
  const isProd = mode === 'production'

  return {
    plugins: [vue()],
    base: isProd ? env.VITE_BUILD_BASE || './' : '/',
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: false,
      cors: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const custom = req.headers['x-custom-cookie']
              if (custom) {
                proxyReq.setHeader('X-Custom-Cookie', custom)
              }
            })
          },
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
  }
})
