import request from '../utils/request'
import { mapQuality, normalizeSong, unwrap } from '../utils/qqNormalize'

/**
 * 推荐新歌 / 最新歌曲
 */
export async function getNewestSong(limit = 10) {
  try {
    const res = await request({
      url: '/getNewSongs',
      method: 'get',
      params: { type: 0 },
    })
    const data = unwrap(res)
    const list =
      data?.new_song?.data?.songlist ||
      data?.data?.songlist ||
      data?.songlist ||
      data?.data ||
      []
    const songs = (Array.isArray(list) ? list : []).slice(0, limit).map((item) => {
      const song = normalizeSong(item)
      return {
        ...song,
        picUrl: song.al?.picUrl,
        song: {
          artists: song.ar,
          album: song.al,
        },
      }
    })
    return { result: songs, code: 200 }
  } catch (_) {
    // 兜底：用搜索热词结果
    const res = await request({
      url: '/getSearchByKey',
      method: 'get',
      params: { key: '热门', limit, page: 1, t: 0 },
    })
    const data = unwrap(res)
    const list = data?.data?.song?.list || data?.song?.list || []
    const songs = list.slice(0, limit).map((item) => {
      const song = normalizeSong(item)
      return {
        ...song,
        picUrl: song.al?.picUrl,
        song: {
          artists: song.ar,
          album: song.al,
        },
      }
    })
    return { result: songs, code: 200 }
  }
}

/**
 * 检查歌曲是否可播（QQ 源以是否有 mid 为准，真正可播依赖登录）
 */
export async function checkMusic(id) {
  if (!id) return { success: false, message: '无效歌曲' }
  return { success: true, message: 'ok' }
}

/**
 * 获取播放地址
 * @param {string} id songmid
 * @param {string} level 音质
 */
function extractPlayUrl(payload, songmid) {
  if (!payload) return ''
  if (typeof payload === 'string') return payload

  const candidates = [
    payload?.data?.playUrl?.[songmid]?.url,
    payload?.data?.playUrl?.[songmid]?.purl,
    payload?.playUrl?.[songmid]?.url,
    payload?.playUrl?.[songmid]?.purl,
    payload?.data?.[songmid]?.url,
    payload?.[songmid]?.url,
    payload?.data?.url,
    payload?.playUrl,
    payload?.url,
  ]

  for (const item of candidates) {
    if (typeof item === 'string' && /^https?:\/\//i.test(item)) return item
  }

  const walk = (node, depth = 0) => {
    if (!node || depth > 4) return ''
    if (typeof node === 'string' && /^https?:\/\//i.test(node) && /\.(mp3|m4a|flac|aac)(\?|$)/i.test(node)) return node
    if (typeof node === 'string' && /^https?:\/\/.*qq\.com/i.test(node)) return node
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walk(item, depth + 1)
        if (hit) return hit
      }
      return ''
    }
    if (typeof node === 'object') {
      if (typeof node.url === 'string' && /^https?:\/\//i.test(node.url)) return node.url
      if (typeof node.purl === 'string' && /^https?:\/\//i.test(node.purl)) return node.purl
      for (const value of Object.values(node)) {
        const hit = walk(value, depth + 1)
        if (hit) return hit
      }
    }
    return ''
  }

  return walk(payload)
}

export async function getMusicUrl(id, level = 'standard') {
  const songmid = String(id || '')
  const quality = mapQuality(level)
  const res = await request({
    url: '/getMusicPlay',
    method: 'get',
    params: {
      songmid,
      quality,
    },
    silentError: true,
  })
  const data = unwrap(res)
  const url = extractPlayUrl(data, songmid) || extractPlayUrl(res, songmid)
  const msg = data?.msg || data?.message || data?.error || res?.msg || res?.message || res?.error || (!url ? '暂无播放链接' : '')

  return {
    code: 200,
    data: [
      {
        id: songmid,
        url: url || null,
        level: quality,
        type: 'qq',
        msg: url ? undefined : msg,
      },
    ],
  }
}

/**
 * 喜欢 / 取消喜欢（QQ API 无稳定公开写接口，先做本地兼容）
 */
export async function likeMusic(_id, _like) {
  return { code: 200, message: 'QQ 源暂不支持同步喜欢状态' }
}

/**
 * 歌词
 * @param {string} id songmid
 */
export async function getLyric(id) {
  const res = await request({
    url: '/getLyric',
    method: 'get',
    params: {
      songmid: String(id || ''),
      isFormat: true,
    },
    silentError: true,
  })
  const data = unwrap(res)

  const pickLyricText = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value?.lyric === 'string') return value.lyric
    if (Array.isArray(value?.lines)) {
      return value.lines
        .map((line) => {
          const t = Number(line.time || 0)
          const mm = String(Math.floor(t / 60000)).padStart(2, '0')
          const ss = String(Math.floor((t % 60000) / 1000)).padStart(2, '0')
          const ms = String(Math.floor(t % 1000)).padStart(3, '0')
          return `[${mm}:${ss}.${ms}]${line.txt || line.lineLyric || ''}`
        })
        .join('\n')
    }
    return ''
  }

  const lyricText =
    pickLyricText(data?.lyric) ||
    pickLyricText(data?.data?.lyric) ||
    pickLyricText(data?.lrc) ||
    pickLyricText(data?.data?.lrc) ||
    ''
  const tlyric =
    pickLyricText(data?.trans) ||
    pickLyricText(data?.tlyric) ||
    pickLyricText(data?.data?.trans) ||
    pickLyricText(data?.data?.tlyric) ||
    ''

  const decode = (text) => {
    if (!text || typeof text !== 'string') return ''
    if (text.includes('[') && text.includes(']')) return text
    try {
      if (typeof atob === 'function' && /^[A-Za-z0-9+/=\s]+$/.test(text) && text.length > 40) {
        return decodeURIComponent(
          Array.prototype.map
            .call(atob(text), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
      }
    } catch (_) {}
    return text
  }

  return {
    code: 200,
    lrc: { lyric: decode(lyricText) },
    tlyric: { lyric: decode(tlyric) },
  }
}
