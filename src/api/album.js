import request from '../utils/request'
import { normalizeAlbum, normalizeSong, unwrap } from '../utils/qqNormalize'

function extractAlbumSongs(data) {
  return (
    data?.data?.list ||
    data?.list ||
    data?.data?.songlist ||
    data?.songlist ||
    data?.data?.songs ||
    data?.getSongInfo ||
    []
  )
}

/**
 * 新碟
 */
export async function getNewAlbum(params = {}) {
  const res = await request({
    url: '/getNewDisks',
    method: 'get',
    params: {
      page: Math.floor((params.offset || 0) / (params.limit || 30)) + 1,
      limit: params.limit || 30,
    },
  })
  const data = unwrap(res)
  const list =
    data?.data?.list ||
    data?.data?.albums ||
    data?.new_album?.data?.albums ||
    data?.albums ||
    data?.list ||
    []
  return {
    code: 200,
    albums: (Array.isArray(list) ? list : []).map(normalizeAlbum),
  }
}

export async function getNewestAlbum(params = {}) {
  return getNewAlbum({ ...params, limit: params.limit || 10 })
}

export async function getUserSubAlbum() {
  return { code: 200, data: [] }
}

/**
 * 专辑详情
 */
export async function getAlbumDetail(params = {}) {
  const id = String(params.id || '')
  const res = await request({
    url: '/getAlbumInfo',
    method: 'get',
    params: {
      albummid: id,
      albumId: id,
    },
  })
  const data = unwrap(res)
  const info = data?.data || data || {}
  const album = normalizeAlbum({
    ...info,
    albummid: info.mid || info.albummid || id,
    albumname: info.name || info.albumname || info.title,
    company: info.company,
    desc: info.desc,
    aDate: info.aDate || info.publicTime,
  })
  const songs = extractAlbumSongs(info).map((item) =>
    normalizeSong({
      ...item,
      albummid: album.mid,
      albumname: album.name,
    })
  )
  return {
    code: 200,
    album,
    songs,
  }
}

export async function subAlbum() {
  return { code: 200, message: 'QQ 源暂不支持收藏专辑' }
}

export async function albumDynamic(id) {
  return {
    code: 200,
    isSub: false,
    subTime: 0,
    commentCount: 0,
    likedCount: 0,
    shareCount: 0,
    id,
  }
}
