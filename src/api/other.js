import request from '../utils/request'
import {
  normalizeAlbum,
  normalizeArtist,
  normalizePlaylist,
  normalizeSong,
  unwrap,
} from '../utils/qqNormalize'

/**
 * 轮播图
 */
export async function getBanner() {
  try {
    const res = await request({
      url: '/getRecommendBanner',
      method: 'get',
    })
    const data = unwrap(res)
    const list =
      data?.focus?.data?.content ||
      data?.data?.content ||
      data?.data?.banner ||
      data?.data?.slider ||
      data?.banner ||
      data?.slider ||
      data?.data ||
      []
    const banners = (Array.isArray(list) ? list : [])
      .map((item, index) => {
        const imageUrl =
          item.pic_info?.url ||
          item.picUrl ||
          item.pic ||
          item.cover ||
          item.imgurl ||
          item.imageUrl ||
          ''
        return {
          imageUrl,
          pic: imageUrl,
          targetId: item.id || item.jump_info?.id || item.focusId || index,
          typeTitle: item.title || item.sub_title || item.name || '',
          url: item.jump_info?.url || item.url || item.jumpurl || item.link || '',
          raw: item,
        }
      })
      .filter((b) => b.imageUrl)
    return { code: 200, banners }
  } catch (_) {
    return { code: 200, banners: [] }
  }
}

/**
 * 搜索
 * type: 1 单曲 / 10 专辑 / 100 歌手 / 1000 歌单 / 1004 MV
 */
export async function search(params = {}) {
  const keywords = params.keywords || params.key || ''
  const limit = params.limit || 30
  const offset = params.offset || 0
  const page = Math.floor(offset / limit) + 1
  const type = Number(params.type || 1)

  // QQ t: 0 单曲 2 歌单 3 歌词 4 专辑 7 MV 8 用户 9 歌手
  const typeMap = {
    1: 0,
    10: 4,
    100: 9,
    1000: 2,
    1004: 7,
  }
  const t = typeMap[type] ?? 0

  const res = await request({
    url: '/getSearchByKey',
    method: 'get',
    params: {
      key: keywords,
      limit,
      page,
      t,
    },
  })
  const data = unwrap(res)
  const body = data?.data || data || {}

  if (type === 1) {
    const list = body.song?.list || body.list || []
    return {
      code: 200,
      result: {
        songs: (Array.isArray(list) ? list : []).map(normalizeSong),
        songCount: body.song?.totalnum || list.length,
      },
    }
  }
  if (type === 10) {
    const list = body.album?.list || body.list || []
    return {
      code: 200,
      result: {
        albums: (Array.isArray(list) ? list : []).map(normalizeAlbum),
        albumCount: body.album?.totalnum || list.length,
      },
    }
  }
  if (type === 100) {
    const list = body.singer?.list || body.list || []
    return {
      code: 200,
      result: {
        artists: (Array.isArray(list) ? list : []).map(normalizeArtist),
        artistCount: body.singer?.totalnum || list.length,
      },
    }
  }
  if (type === 1000) {
    const list = body.diss?.list || body.list || []
    return {
      code: 200,
      result: {
        playlists: (Array.isArray(list) ? list : []).map(normalizePlaylist),
        playlistCount: body.diss?.totalnum || list.length,
      },
    }
  }
  if (type === 1004) {
    const list = body.mv?.list || body.list || []
    const mvs = (Array.isArray(list) ? list : []).map((item) => ({
      id: item.v_id || item.vid || item.id,
      name: item.mv_name || item.title || item.name,
      cover: item.mv_pic_url || item.picurl || item.pic || item.cover,
      artistName: item.singer_name || item.singerName || '',
      artists: (item.singers || []).map((s) => ({
        id: s.mid || s.id,
        name: s.name,
      })),
      playCount: item.play_count || item.listennum || 0,
      duration: (item.duration || 0) * 1000,
    }))
    return {
      code: 200,
      result: {
        mvs,
        mvCount: body.mv?.totalnum || mvs.length,
      },
    }
  }

  return { code: 200, result: {} }
}
