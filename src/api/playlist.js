import request from '../utils/request'
import { normalizePlaylist, normalizeRank, normalizeSong, unwrap } from '../utils/qqNormalize'
import { QQ_LIKED_PLAYLIST_ID } from './user'

async function getLikedSongs() {
  const res = await request({
    url: '/liked-songs',
    method: 'get',
    silentError: true,
  })
  const data = unwrap(res) || res
  return {
    code: 200,
    songs: (data?.songs || []).map(normalizeSong),
    playlist: data?.playlist || null,
  }
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
  // 排行榜
  if (Array.isArray(data?.song)) return data.song
  if (Array.isArray(data?.data?.song)) return data.data.song
  if (Array.isArray(data?.songs)) return data.songs
  return []
}

function extractPlaylistMeta(data, id) {
  const cd = data?.cdlist?.[0] || data?.data?.cdlist?.[0]
  if (cd) {
    return normalizePlaylist({
      ...cd,
      dissid: cd.disstid || cd.dissid || id,
    })
  }
  if (data?.dissname || data?.title || data?.logo) {
    return normalizePlaylist({ ...data, dissid: id })
  }
  // 排行榜 meta
  if (data?.topTitle || data?.topId || data?.title) {
    const rank = normalizeRank({ ...data, id: data.topId || id })
    return {
      ...rank,
      trackCount: extractSongList(data).length,
      creator: { nickname: 'QQ音乐', userId: '' },
      followed: false,
      description: rank.description || '',
      createTime: Date.now(),
      type: 'playlist',
    }
  }
  return normalizePlaylist({ id, dissid: id, dissname: '歌单' })
}

/**
 * 推荐歌单
 */
export async function getRecommendedSongList(num = 10) {
  const res = await request({
    url: '/getSongLists',
    method: 'get',
    params: {
      categoryId: 10000000,
      limit: num,
      page: 1,
      sortId: 5,
    },
  })
  const data = unwrap(res)
  const list =
    data?.data?.list ||
    data?.list ||
    data?.data?.playlist ||
    data?.requestdata?.data?.list ||
    []
  const result = (Array.isArray(list) ? list : []).slice(0, num).map(normalizePlaylist)
  return { code: 200, result }
}

/**
 * 排行榜列表
 */
export async function getTopList() {
  const res = await request({
    url: '/getTopLists',
    method: 'get',
  })
  const data = unwrap(res)
  const topList = data?.data?.topList || data?.topList || []
  let list = []

  if (Array.isArray(topList) && topList.length && (topList[0].topTitle || topList[0].picUrl || topList[0].id)) {
    list = topList.map((t) =>
      normalizeRank({
        id: t.topId || t.id,
        topId: t.topId || t.id,
        topTitle: t.topTitle || t.title || t.name,
        picUrl: t.picUrl || t.cover || t.pic_v12 || t.pic,
        updateTime: t.updateTips || t.update_time || t.listenCount || t.listen_num,
        listenCount: t.listenCount || t.listennum || t.listen_num,
        intro: t.intro,
        updateFrequency: t.updateTips || (t.listenCount ? `${t.listenCount} 人收听` : ''),
      })
    )
  } else {
    const groups = data?.data?.group || data?.group || data?.data || []
    if (Array.isArray(groups)) {
      groups.forEach((g) => {
        if (g.topTitle || g.picUrl || g.topId) {
          list.push(
            normalizeRank({
              id: g.topId || g.id,
              topId: g.topId || g.id,
              topTitle: g.topTitle || g.title || g.name,
              picUrl: g.picUrl || g.cover || g.pic,
              updateTime: g.updateTips || g.listenCount,
              listenCount: g.listenCount || g.listennum,
            })
          )
          return
        }
        const tops = g.toplist || g.list || g.GroupTopList || []
        tops.forEach((t) => {
          list.push(
            normalizeRank({
              id: t.topId || t.id,
              topId: t.topId || t.id,
              topTitle: t.title || t.topTitle || t.name,
              picUrl: t.picUrl || t.cover || t.pic_v12 || t.pic,
              updateTime: t.updateTips || t.update_time || t.listen_num,
              listenCount: t.listennum || t.listen_num || t.listenCount,
              intro: t.intro,
            })
          )
        })
      })
    }
  }

  return { code: 200, list }
}

/**
 * 歌单 / 排行榜详情
 */
export async function getPlaylistDetail(params = {}) {
  const id = String(params.id || '')
  if (id === QQ_LIKED_PLAYLIST_ID) {
    const liked = await getLikedSongs()
    const songs = liked.songs || []
    const meta = liked.playlist || {}
    return {
      code: 200,
      playlist: {
        id,
        name: meta.name || '我喜欢',
        coverImgUrl: meta.coverImgUrl || songs[0]?.al?.picUrl || '',
        picUrl: meta.picUrl || songs[0]?.al?.picUrl || '',
        trackCount: songs.length,
        playCount: 0,
        description: 'QQ 音乐我喜欢的歌曲',
        createTime: Date.now(),
        creator: { nickname: 'QQ音乐', userId: '' },
        followed: false,
        type: 'playlist',
        tracks: songs,
        trackIds: songs.map((s) => ({ id: s.id })),
      },
    }
  }
  let data = null
  let fromRank = false

  try {
    const res = await request({
      url: '/getSongListDetail',
      method: 'get',
      params: { disstid: id },
    })
    data = unwrap(res)
    const songs = extractSongList(data)
    if (!songs.length && (data?.code === -1 || data?.msg?.includes?.('privacy'))) {
      throw new Error('fallback-rank')
    }
  } catch (_) {
    fromRank = true
    const res = await request({
      url: '/getRanks',
      method: 'get',
      params: { topId: id, page: 1, limit: 100 },
    })
    data = unwrap(res)
  }

  const songs = extractSongList(data).map(normalizeSong)
  const playlist = extractPlaylistMeta(data, id)
  playlist.tracks = songs
  playlist.trackIds = songs.map((s) => ({ id: s.id }))
  playlist.trackCount = songs.length
  if (fromRank) playlist.type = 'rank'

  return {
    code: 200,
    playlist,
  }
}

/**
 * 歌单全部歌曲
 */
export async function getPlaylistAll(params = {}) {
  const id = String(params.id || '')
  if (id === QQ_LIKED_PLAYLIST_ID) {
    const liked = await getLikedSongs()
    const all = liked.songs || []
    const limitLiked = Number(params.limit || 1000)
    const offsetLiked = Number(params.offset || 0)
    const songs = all.slice(offsetLiked, offsetLiked + limitLiked)
    return {
      code: 200,
      songs,
      privileges: songs.map(() => ({ pl: 1, st: 0, fee: 0 })),
    }
  }
  const limit = Number(params.limit || 1000)
  const offset = Number(params.offset || 0)

  let data = null
  try {
    const res = await request({
      url: '/getSongListDetail',
      method: 'get',
      params: { disstid: id },
    })
    data = unwrap(res)
  } catch (_) {
    const res = await request({
      url: '/getRanks',
      method: 'get',
      params: { topId: id, page: Math.floor(offset / Math.max(limit, 1)) + 1, limit },
    })
    data = unwrap(res)
  }

  const all = extractSongList(data).map(normalizeSong)
  const songs = all.slice(offset, offset + limit)
  return {
    code: 200,
    songs,
    privileges: songs.map(() => ({ pl: 1, st: 0, fee: 0 })),
  }
}

/**
 * 每日推荐（需登录）
 */
export async function getRecommendSongs() {
  try {
    const res = await request({
      url: '/getDailyRecommend',
      method: 'get',
    })
    const data = unwrap(res)
    const list =
      data?.data?.songlist ||
      data?.songlist ||
      data?.data?.v_songinfo ||
      data?.data ||
      []
    const dailySongs = (Array.isArray(list) ? list : []).map(normalizeSong)
    return { code: 200, data: { dailySongs } }
  } catch (_) {
    // 未登录或失败时用推荐接口兜底
    const res = await request({ url: '/getRecommend', method: 'get' })
    const data = unwrap(res)
    const list =
      data?.data?.songlist ||
      data?.recomPlaylist?.data?.v_hot ||
      data?.new_song?.data?.songlist ||
      []
    const dailySongs = (Array.isArray(list) ? list : []).slice(0, 30).map((item) => {
      if (item.songlist) return null
      return normalizeSong(item.track || item)
    }).filter(Boolean)
    return { code: 200, data: { dailySongs } }
  }
}

/** 收藏歌单 - QQ 公开 API 有限，返回兼容结构 */
export async function subPlaylist() {
  return { code: 200, message: 'QQ 源暂不支持收藏歌单' }
}

export async function playlistDynamic(id) {
  return {
    code: 200,
    subscribed: false,
    commentCount: 0,
    shareCount: 0,
    playCount: 0,
    id,
  }
}

export async function getIntelligenceList() {
  return { code: 200, data: [] }
}

export async function createPlaylist() {
  return { code: 200, message: 'QQ 源暂不支持新建歌单' }
}

export async function updatePlaylist() {
  return { code: 200, message: 'QQ 源暂不支持修改歌单' }
}

export async function deletePlaylist() {
  return { code: 200, message: 'QQ 源暂不支持删除歌单' }
}
