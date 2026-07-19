import request from '../utils/request'
import { clearLoginCookies, getSession, isLogin } from '../utils/authority'
import {
  normalizePlaylist,
  normalizeSong,
  normalizeUserProfile,
  qqAvatarUrl,
  unwrap,
} from '../utils/qqNormalize'

export const QQ_LIKED_PLAYLIST_ID = '__qq_liked_songs__'

function reportPlaylistDebug(event, payload = {}) {
  try {
    fetch('http://127.0.0.1:37901/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, payload }),
    }).catch(() => {})
  } catch (_) {}
}

export async function getUserProfile() {
  const session = getSession() || {}
  const uin = String(session.uin || session.loginUin || '').replace(/^o/, '')
  const profile = normalizeUserProfile(session, uin ? qqAvatarUrl(uin, 100) : '')
  return {
    code: 200,
    profile,
    account: { id: profile.userId },
  }
}

export async function getUserPlaylist(params = {}) {
  if (!isLogin()) {
    reportPlaylistDebug('user-api-not-login')
    return { code: 200, playlist: [] }
  }
  const session = getSession() || {}
  const uin = String(params.uid || session.uin || session.loginUin || '').replace(/^o/, '')
  if (!uin) {
    reportPlaylistDebug('user-api-no-uin', { sessionKeys: Object.keys(session || {}) })
    return { code: 200, playlist: [] }
  }

  try {
    const liked = await getLikelist(uin)
    const likedPlaylist = {
      id: QQ_LIKED_PLAYLIST_ID,
      name: '我喜欢',
      coverImgUrl: qqAvatarUrl(uin, 100),
      picUrl: qqAvatarUrl(uin, 100),
      trackCount: liked.count || 0,
      creator: { nickname: session.nick || session.nickname || uin, userId: uin },
      followed: false,
      type: 'playlist',
      qqPlaylistType: 'liked',
      isQQLiked: true,
    }
    const res = await request({
      url: '/user/getUserPlaylists',
      method: 'get',
      params: {
        uin,
        offset: params.offset || 0,
        limit: params.limit || 100,
      },
      silentError: true,
    })
    const data = unwrap(res)
    reportPlaylistDebug('user-api-response-shape', {
      uin,
      resKeys: Object.keys(res || {}),
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      responseDataKeys: data?.response?.data ? Object.keys(data.response.data) : [],
      dataDataKeys: data?.data && typeof data.data === 'object' ? Object.keys(data.data) : [],
      hasPlaylists: Array.isArray(data?.data?.playlists || data?.response?.data?.playlists || data?.playlists),
      directPlaylistLength: (data?.data?.playlists || data?.response?.data?.playlists || data?.playlists || []).length || 0,
    })
    const playlists =
      data?.data?.playlists ||
      data?.response?.data?.playlists ||
      data?.playlists ||
      data?.data?.list ||
      data?.list ||
      []

    if (Array.isArray(playlists) && playlists.length) {
      const normalized = playlists.map((item) => ({
        ...normalizePlaylist(item),
        qqPlaylistType: 'created',
      }))
      reportPlaylistDebug('user-api-normalized-direct', {
        rawLength: playlists.length,
        normalizedLength: normalized.length,
        sampleRawKeys: Object.keys(playlists[0] || {}),
        sample: normalized.slice(0, 3).map((item) => ({ id: item.id, name: item.name, trackCount: item.trackCount, qqPlaylistType: item.qqPlaylistType })),
      })
      return {
        code: 200,
        playlist: [likedPlaylist, ...normalized],
      }
    }

    const created =
      data?.data?.mydiss?.list ||
      data?.response?.data?.mydiss?.list ||
      data?.mydiss?.list ||
      data?.data?.createdDissList ||
      data?.createdDissList ||
      data?.data?.createdList ||
      data?.createdList ||
      data?.data?.create ||
      data?.create ||
      []
    const collected =
      data?.data?.mymusic ||
      data?.response?.data?.mymusic ||
      data?.mymusic ||
      data?.data?.collectDissList ||
      data?.collectDissList ||
      data?.data?.collect ||
      data?.collect ||
      []

    const listA = (Array.isArray(created) ? created : []).map((item) => ({
      ...normalizePlaylist(item),
      qqPlaylistType: 'created',
    }))
    const listB = (Array.isArray(collected) ? collected : [])
      .map((item) => {
        if (item.dissid || item.disstid || item.id || item.dirid || item.dir_id) {
          return {
            ...normalizePlaylist(item),
            qqPlaylistType: 'collect',
          }
        }
        return null
      })
      .filter(Boolean)

    reportPlaylistDebug('user-api-normalized-split', {
      createdRawLength: Array.isArray(created) ? created.length : 0,
      collectedRawLength: Array.isArray(collected) ? collected.length : 0,
      listALength: listA.length,
      listBLength: listB.length,
      createdSampleKeys: Object.keys((Array.isArray(created) ? created[0] : null) || {}),
      collectedSampleKeys: Object.keys((Array.isArray(collected) ? collected[0] : null) || {}),
    })
    return { code: 200, playlist: [likedPlaylist, ...listA, ...listB] }
  } catch (error) {
    reportPlaylistDebug('user-api-error', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    })
    return { code: 200, playlist: [] }
  }
}

export async function getUserPlaylistCount() {
  const { playlist } = await getUserPlaylist({})
  const created = playlist.filter((item) => item.qqPlaylistType !== 'collect')
  const collected = playlist.filter((item) => item.qqPlaylistType === 'collect')
  return {
    code: 200,
    createdPlaylistCount: created.length,
    subPlaylistCount: collected.length,
    codeStatus: 200,
  }
}

export async function logout() {
  clearLoginCookies()
  return { code: 200 }
}

export async function getLikelist(uid) {
  if (!isLogin()) {
    reportPlaylistDebug('liked-api-not-login')
    return { code: 200, ids: [], count: 0, likedId: null }
  }
  const session = getSession() || {}
  const uin = String(uid || session.uin || session.loginUin || '').replace(/^o/, '')
  if (!uin) {
    reportPlaylistDebug('liked-api-no-uin', { sessionKeys: Object.keys(session || {}) })
    return { code: 200, ids: [], count: 0, likedId: null }
  }

  try {
    const res = await request({
      url: '/user/getUserDetail',
      method: 'get',
      params: { uin },
      silentError: true,
    })
    const data = unwrap(res)
    const mymusic = data?.data?.mymusic || []
    const liked = mymusic.find((item) => {
      if (!item) return false
      if (item.title && String(item.title).includes('喜欢')) return true
      if (item.type === 1) return true
      return false
    })
    const count = liked?.num0 ?? liked?.songnum ?? liked?.totalSongNum ?? 0
    reportPlaylistDebug('liked-api-detail', {
      uin,
      mymusicLength: mymusic.length,
      likedId: liked?.id,
      likedTitle: liked?.title,
      count,
    })
    return {
      code: 200,
      ids: [],
      songs: [],
      count: Number(count) || 0,
      likedId: liked?.id ? String(liked.id) : null,
    }
  } catch (error) {
    reportPlaylistDebug('liked-api-error', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    })
    return { code: 200, ids: [], count: 0, likedId: null }
  }
}

export async function getVipInfo() {
  return {
    code: 200,
    data: {
      redVipLevel: 0,
      associator: { vipCode: 0 },
    },
  }
}
