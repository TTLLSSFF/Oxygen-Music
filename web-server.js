// 同时启动 QQ 音乐 API 与静态文件服务，Web 部署只需一个命令。
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_PORT = Number(process.env.QQ_MUSIC_API_PORT || process.env.API_PORT || 3200)
const WEB_PORT = Number(process.env.PORT || 30000)
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
  const urlPath = req.url.split('?')[0]
  const filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath)
  const ext = path.extname(filePath).toLowerCase()
  const contentType = mimeTypes[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
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
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
    pipeline(proxyRes, res, () => {})
  })

  proxyReq.on('error', (err) => {
    console.error('API proxy error:', err)
    if (!res.headersSent) {
      res.writeHead(502)
      res.end('API service unavailable')
    }
  })

  pipeline(req, proxyReq, () => {})
}

function startQqMusicApi() {
  return new Promise((resolve, reject) => {
    const apiEntry = path.join(__dirname, 'server', 'qq-music-api.js')
    const child = spawn(process.execPath, [apiEntry], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(API_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let settled = false
    const settleOk = () => {
      if (settled) return
      settled = true
      resolve(child)
    }
    const settleFail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    child.stdout.on('data', (buf) => {
      const text = buf.toString()
      process.stdout.write(text)
      if (/server running|listening|localhost/i.test(text)) settleOk()
    })
    child.stderr.on('data', (buf) => process.stderr.write(buf.toString()))
    child.on('error', settleFail)
    child.on('exit', (code) => {
      if (!settled) settleFail(new Error(`QQ Music API exited early with code ${code}`))
    })

    // 兜底：即使没有明确日志也继续
    setTimeout(settleOk, 2500)
  })
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url === '/api') proxyToApi(req, res)
  else serveStatic(req, res)
})

;(async () => {
  try {
    await startQqMusicApi()
    console.log(`QQ Music API started on port ${API_PORT}`)
  } catch (error) {
    console.error('Failed to start QQ Music API:', error)
    process.exit(1)
  }

  server.listen(WEB_PORT, () => {
    console.log(`Oxygen Music web server listening on port ${WEB_PORT}`)
    console.log(`Open http://localhost:${WEB_PORT} in your browser`)
  })
})()
