import http from 'http'
import { URL, fileURLToPath, pathToFileURL } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(__dirname, '../node_modules/@sansenjian/qq-music-api')

const { default: apiApp } = await import(pathToFileURL(path.join(pkgRoot, 'dist/app.js')).href)
const {
  l: initializeUserInfo,
  n: extractUinFromCookie,
  u: setUserInfo,
} = await import(pathToFileURL(path.join(pkgRoot, 'dist/cookieResolver-s0fxfqAN.js')).href)
const { getUserDetail, songListDetail } = await import(pathToFileURL(path.join(pkgRoot, 'dist/services.js')).href)
const { normalizeSong } = await import(pathToFileURL(path.resolve(__dirname, '../src/utils/qqNormalize.js')).href)

const port = Number(process.env.QQ_MUSIC_API_PORT || process.env.API_PORT || '3200')

function parseCookieObject(cookie = '') {
  const obj = {}
  cookie.split(';').map((item) => item.trim()).filter(Boolean).forEach((item) => {
    const idx = item.indexOf('=')
    if (idx > 0) {
      const key = item.slice(0, idx).trim()
      const value = item.slice(idx + 1).trim()
      if (key) obj[key] = value
    }
  })
  return obj
}

function setGlobalCookie(cookie) {
  const uin = extractUinFromCookie(cookie) || '0'
  setUserInfo({
    loginUin: uin,
    uin,
    cookie,
    cookieList: cookie.split(';').map((item) => item.trim()).filter(Boolean),
    cookieObject: parseCookieObject(cookie),
    refreshData: () => ({}),
  })
}

function extractSongList(data) {
  const cd = data?.cdlist?.[0] || data?.data?.cdlist?.[0]
  if (cd?.songlist) return cd.songlist
  if (Array.isArray(data?.songlist)) return data.songlist
  if (Array.isArray(data?.data?.songlist)) return data.data.songlist
  if (Array.isArray(data?.songlist?.list)) return data.songlist.list
  if (Array.isArray(data?.data?.list)) return data.data.list
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.songInfoList)) return data.songInfoList
  if (Array.isArray(data?.data?.songInfoList)) return data.data.songInfoList
  if (Array.isArray(data?.song)) return data.song
  if (Array.isArray(data?.data?.song)) return data.data.song
  if (Array.isArray(data?.songs)) return data.songs
  return []
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function handleLikedSongs(req, res, cookie) {
  if (!cookie) {
    sendJson(res, 401, { code: 401, error: '缺少登录 Cookie' })
    return
  }
  try {
    const uin = extractUinFromCookie(cookie) || '0'
    const detail = await getUserDetail({ uin, cookie })
    const payload = detail.body?.response || detail.response || detail
    const mymusic = payload?.data?.mymusic || []
    const liked = mymusic.find((item) => {
      if (!item) return false
      if (item.title && String(item.title).includes('喜欢')) return true
      if (item.type === 1) return true
      return false
    })

    if (!liked?.id) {
      sendJson(res, 200, { code: 200, songs: [], playlist: null })
      return
    }

    const listRes = await songListDetail({
      method: 'get',
      params: { disstid: String(liked.id) },
      option: {
        headers: {
          Cookie: cookie,
          Referer: `https://y.qq.com/portal/profile.html?uin=${uin}`,
        },
      },
    })
    const raw = listRes.body?.response || listRes.response || listRes
    const songs = extractSongList(raw).map(normalizeSong)

    sendJson(res, 200, {
      code: 200,
      songs,
      playlist: {
        id: String(liked.id),
        name: liked.title || '我喜欢',
        trackCount: songs.length,
        coverImgUrl: songs[0]?.al?.picUrl || '',
        picUrl: songs[0]?.al?.picUrl || '',
      },
    })
  } catch (error) {
    console.error('[liked-songs]', error?.message || error)
    sendJson(res, 502, { code: 502, error: error?.message || '获取我喜欢歌曲失败' })
  }
}

const apiCallback = apiApp.callback()

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  const cookie =
    req.headers['x-custom-cookie'] ||
    url.searchParams.get('cookie') ||
    ''

  if (typeof cookie === 'string' && cookie.trim()) {
    setGlobalCookie(cookie.trim())
  }

  if (url.pathname === '/liked-songs') {
    await handleLikedSongs(req, res, cookie.trim())
    return
  }

  apiCallback(req, res)
})

initializeUserInfo()

server.listen(port, () => {
  console.log(`QQ Music API wrapper listening on port ${port}`)
})
