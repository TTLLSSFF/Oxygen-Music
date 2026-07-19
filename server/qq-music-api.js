import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const apiEntry = path.join(root, 'node_modules', '@sansenjian', 'qq-music-api', 'dist', 'app.js')
const port = process.env.QQ_MUSIC_API_PORT || process.env.API_PORT || '3200'

const child = spawn(process.execPath, [apiEntry], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})

process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
