import request from '../utils/request'
import { unwrap } from '../utils/qqNormalize'

/**
 * 收藏 MV
 */
export async function getUserSubMV() {
  return { code: 200, data: [] }
}

/**
 * 歌手 MV
 */
export async function getArtistMV(params = {}) {
  const id = String(params.id || '')
  try {
    const res = await request({
      url: '/getSingerMv',
      method: 'get',
      params: {
        singermid: id,
        page: Math.floor((params.offset || 0) / (params.limit || 20)) + 1,
        num: params.limit || 20,
      },
    })
    const data = unwrap(res)
    const list = data?.data?.list || data?.list || data?.data?.mvlist || []
    const mvs = (Array.isArray(list) ? list : []).map((item) => ({
      id: item.vid || item.v_id || item.id,
      name: item.title || item.name || item.mv_name,
      imgurl: item.pic || item.picurl || item.cover || item.mv_pic_url,
      artistName: item.singer_name || '',
      playCount: item.playcnt || item.listennum || 0,
      duration: (item.duration || 0) * 1000,
    }))
    return { code: 200, mvs }
  } catch (_) {
    return { code: 200, mvs: [] }
  }
}

/**
 * MV 详情
 */
export async function getMVDetail(id) {
  const res = await request({
    url: '/getMv',
    method: 'get',
    params: { vid: id },
  })
  const data = unwrap(res)
  const info = data?.data || data || {}
  const name = info.name || info.title || info.mvname || 'MV'
  const cover = info.cover_pic || info.picurl || info.pic || info.cover || ''
  const brs = [
    { br: 720 },
    { br: 1080 },
  ]
  return {
    code: 200,
    data: {
      id,
      name,
      cover,
      desc: info.desc || '',
      artistName: info.singer_name || info.singerName || '',
      brs,
      duration: info.duration || 0,
    },
  }
}

/**
 * MV 播放地址
 */
export async function getMVUrl(id, r = 720) {
  try {
    const res = await request({
      url: '/getMvPlay',
      method: 'get',
      params: {
        vid: id,
        resolution: r,
      },
    })
    const data = unwrap(res)
    const url =
      data?.data?.url ||
      data?.url ||
      data?.data?.[id]?.url ||
      data?.data?.mp4?.[0] ||
      data?.mp4?.[0] ||
      ''
    return {
      code: 200,
      data: {
        id,
        url: typeof url === 'string' ? url : url?.freeflow_url?.[0] || url?.url || '',
        r,
      },
    }
  } catch (_) {
    return { code: 200, data: { id, url: '', r } }
  }
}
