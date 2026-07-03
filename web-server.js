// 同时启动网易云音乐 API Enhanced 与静态文件服务，
// 让 Web 部署只需一个命令即可运行。
const http = require('http')
const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream')
const startNeteaseMusicApi = require('./src/electron/services')

const API_PORT = 36530
const WEB_PORT = process.env.PORT || 30000
const DIST_DIR = path.join(__dirname, 'dist')

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0]
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath)
  const ext = path.extname(filePath).toLowerCase()
  const contentType = mimeTypes[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA 路由回退到 index.html
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404)
            res.end('Not found')
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(content2)
          }
        })
      } else {
        console.error('Static file error:', err)
        res.writeHead(500)
        res.end('Server error')
      }
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  })
}

function proxyToApi(req, res) {
  const [rawPath, query] = req.url.split('?')
  const targetPath = rawPath.replace(/^\/api/, '') || '/'
  const options = {
    hostname: '127.0.0.1',
    port: API_PORT,
    path: targetPath + (query ? '?' + query : ''),
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` },
  }

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    pipeline(proxyRes, res, () => {})
  })

  proxyReq.on('error', (err) => {
    console.error('API proxy error:', err)
    res.writeHead(502)
    res.end('API service unavailable')
  })

  pipeline(req, proxyReq, () => {})
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url === '/api') {
    proxyToApi(req, res)
  } else {
    serveStatic(req, res)
  }
})

;(async () => {
  try {
    await startNeteaseMusicApi()
    console.log(`NetEase Cloud Music API Enhanced started on port ${API_PORT}`)
  } catch (error) {
    console.error('Failed to start NetEase Cloud Music API:', error)
    process.exit(1)
  }

  server.listen(WEB_PORT, () => {
    console.log(`Oxygen Music web server listening on port ${WEB_PORT}`)
    console.log(`Open http://localhost:${WEB_PORT} in your browser`)
  })
})()
