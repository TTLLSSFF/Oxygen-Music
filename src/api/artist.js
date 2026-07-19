import request from '../utils/request'
import { normalizeAlbum, normalizeArtist, normalizeSong, unwrap } from '../utils/qqNormalize'

/**
 * 推荐歌手
 */
export async function getRecommendedArtists() {
  try {
    const res = await request({
      url: '/getSingerList',
      method: 'get',
      params: {
        area: -100,
        sex: -100,
        genre: -100,
        index: -100,
      },
    })
    const data = unwrap(res)
    const list =
      data?.data?.list ||
      data?.data?.singerlist ||
      data?.singerlist ||
      data?.list ||
      []
    // 可能是热门标签分组
    let artists = []
    if (Array.isArray(list) && list[0]?.singer_list) {
      list.forEach((g) => {
        ;(g.singer_list || []).forEach((s) => artists.push(normalizeArtist(s)))
      })
    } else {
      artists = (Array.isArray(list) ? list : []).map(normalizeArtist)
    }
    return { code: 200, artists }
  } catch (_) {
    const res = await request({
      url: '/getSearchByKey',
      method: 'get',
      params: { key: '热门歌手', t: 9, limit: 50, page: 1 },
    })
    const data = unwrap(res)
    const list = data?.data?.singer?.list || []
    return { code: 200, artists: list.map(normalizeArtist) }
  }
}

export async function getUserSubArtists() {
  return { code: 200, data: [] }
}

/**
 * 歌手详情 + 热门歌曲
 */
export async function getArtistDetail(params = {}) {
  const id = String(params.id || '')
  const [hotRes, descRes, starRes] = await Promise.allSettled([
    request({
      url: '/getSingerHotsong',
      method: 'get',
      params: { singermid: id, page: 1, num: 50 },
    }),
    request({
      url: '/getSingerDesc',
      method: 'get',
      params: { singermid: id },
    }),
    request({
      url: '/getSingerStarNum',
      method: 'get',
      params: { singermid: id },
    }),
  ])

  const hotData = hotRes.status === 'fulfilled' ? unwrap(hotRes.value) : {}
  const descData = descRes.status === 'fulfilled' ? unwrap(descRes.value) : {}
  const starData = starRes.status === 'fulfilled' ? unwrap(starRes.value) : {}

  const songlist =
    hotData?.data?.songlist ||
    hotData?.songlist ||
    hotData?.data?.list ||
    hotData?.list ||
    []

  const hotSongs = (Array.isArray(songlist) ? songlist : []).map(normalizeSong)
  const first = hotSongs[0]
  const artist = normalizeArtist({
    singerMID: id,
    mid: id,
    singerName: first?.ar?.[0]?.name || id,
    desc: descData?.data?.desc || descData?.desc || '',
    fans: starData?.data?.num || starData?.num || 0,
  })

  return {
    code: 200,
    artist,
    hotSongs,
  }
}

export async function getArtistTopSong(params = {}) {
  const id = String(params.id || '')
  const res = await request({
    url: '/getSingerHotsong',
    method: 'get',
    params: { singermid: id, page: 1, num: 50 },
  })
  const data = unwrap(res)
  const list = data?.data?.songlist || data?.songlist || data?.data?.list || []
  return {
    code: 200,
    songs: (Array.isArray(list) ? list : []).map(normalizeSong),
  }
}

export async function getArtistAlbum(params = {}) {
  const id = String(params.id || '')
  const res = await request({
    url: '/getSingerAlbum',
    method: 'get',
    params: {
      singermid: id,
      page: Math.floor((params.offset || 0) / (params.limit || 30)) + 1,
      num: params.limit || 30,
    },
  })
  const data = unwrap(res)
  const list = data?.data?.list || data?.list || data?.data?.albumList || []
  return {
    code: 200,
    hotAlbums: (Array.isArray(list) ? list : []).map(normalizeAlbum),
  }
}

export async function getArtistFansCount(id) {
  try {
    const res = await request({
      url: '/getSingerStarNum',
      method: 'get',
      params: { singermid: id },
    })
    const data = unwrap(res)
    const num = data?.data?.num || data?.num || 0
    return {
      code: 200,
      data: {
        follow: false,
        fansCnt: num,
        friendCnt: 0,
        followCnt: 0,
      },
    }
  } catch (_) {
    return {
      code: 200,
      data: { follow: false, fansCnt: 0, friendCnt: 0, followCnt: 0 },
    }
  }
}

export async function subArtist() {
  return { code: 200, message: 'QQ 源暂不支持收藏歌手' }
}
