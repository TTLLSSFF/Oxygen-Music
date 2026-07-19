/**
 * 将 QQ 音乐接口原始数据归一化为项目现有 UI 使用的网易云风格结构。
 */

export function albumCover(mid, size = 300) {
  if (!mid) return 'https://y.gtimg.cn/mediastyle/global/img/album_300.png'
  return `https://y.gtimg.cn/music/photo_new/T002R${size}x${size}M000${mid}.jpg`
}

export function singerCover(mid, size = 300) {
  if (!mid) return 'https://y.gtimg.cn/mediastyle/global/img/singer_300.png'
  return `https://y.gtimg.cn/music/photo_new/T001R${size}x${size}M000${mid}.jpg`
}

export function unwrap(payload) {
  if (!payload || typeof payload !== 'object') return payload
  if (payload.response !== undefined) return payload.response
  if (payload.data !== undefined && payload.code === undefined && payload.response === undefined) {
    // 有些接口直接返回 { data }
    return payload
  }
  return payload
}

function pickSingers(raw) {
  if (Array.isArray(raw)) {
    return raw.map((s) => ({
      id: s.mid || s.singerMID || s.singer_mid || String(s.id || s.singer_id || ''),
      name: s.name || s.singerName || s.title || '未知歌手',
      mid: s.mid || s.singerMID || s.singer_mid || '',
    }))
  }
  if (typeof raw === 'string' && raw) {
    return raw.split(/[\/&、]/).filter(Boolean).map((name) => ({ id: name, name, mid: '' }))
  }
  if (raw && typeof raw === 'object') {
    return [{
      id: raw.mid || String(raw.id || ''),
      name: raw.name || raw.singerName || '未知歌手',
      mid: raw.mid || '',
    }]
  }
  return [{ id: 'unknown', name: '未知歌手', mid: '' }]
}

export function normalizeSong(raw = {}) {
  // 兼容排行榜字段：songId/title/singerName/albumMid/cover
  const mid =
    raw.songmid ||
    raw.mid ||
    raw.song_mid ||
    raw.media_mid ||
    raw.strMediaMid ||
    ''
  const songId = raw.songid || raw.songId || raw.id || mid
  const albumMid =
    raw.albummid ||
    raw.albumMid ||
    raw.album_mid ||
    raw.album?.mid ||
    raw.album?.pmid ||
    ''
  const albumName =
    raw.albumname ||
    raw.albumName ||
    raw.album_name ||
    raw.album?.name ||
    raw.album?.title ||
    ''
  const name =
    raw.songname ||
    raw.songName ||
    raw.name ||
    raw.title ||
    raw.songTitle ||
    '未知歌曲'
  const singers = pickSingers(
    raw.singer || raw.singers || raw.singerName || raw.singer_name || raw.singername
  )
  const interval = Number(raw.interval || raw.dt || raw.songTime || raw.time || 0)
  // interval 有时已是毫秒
  const dt = interval > 10000 ? interval : interval * 1000
  const picUrl =
    raw.picUrl ||
    raw.cover ||
    raw.albumPic ||
    raw.album?.picUrl ||
    albumCover(albumMid)

  // 无 mid 时用 songId 作为 id，播放时可能需要额外查 mid；尽量保留可识别字段
  const id = mid || String(songId)

  return {
    id,
    songmid: mid || (String(songId).match(/^[0-9a-zA-Z]{14}$/) ? String(songId) : ''),
    songid: songId,
    name,
    ar: singers,
    al: {
      id: albumMid || String(raw.albumid || raw.albumId || raw.album?.id || ''),
      name: albumName,
      picUrl,
      mid: albumMid,
    },
    dt,
    mv: raw.vid || raw.mv?.vid || raw.mv?.id || 0,
    playable: true,
    reason: '',
    fee: raw.pay?.pay_play || raw.pay?.payplay || 0,
    type: 'qq',
    raw,
  }
}

export function normalizePlaylist(raw = {}) {
  const id = String(raw.dissid || raw.disstid || raw.tid || raw.dirid || raw.dir_id || raw.content_id || raw.id || '')
  const name = raw.dissname || raw.diss_name || raw.dirname || raw.dir_name || raw.title || raw.name || '未命名歌单'
  const coverImgUrl = raw.imgurl || raw.picurl || raw.pic_url || raw.logo || raw.cover || raw.picUrl || raw.coverImgUrl || raw.cover_url || albumCover(raw.album_pic_mid || raw.pic_mid)
  const subtitleCount = String(raw.subtitle || raw.subTitle || '').match(/(\d+)\s*首/)
  const trackCount = Number(
    raw.songnum ??
      raw.songNum ??
      raw.song_num ??
      raw.song_cnt ??
      raw.songcnt ??
      raw.total_song_num ??
      raw.totalSongNum ??
      raw.total_song ??
      raw.trackCount ??
      raw.size ??
      raw.num ??
      subtitleCount?.[1] ??
      0
  )
  const creatorName = raw.nickname || raw.nick || raw.username || raw.creator?.name || raw.creator || raw.creator_uin || ''

  return {
    id,
    dissid: raw.dissid || raw.disstid || '',
    disstid: raw.disstid || raw.dissid || '',
    dirid: raw.dirid || raw.dir_id || '',
    name,
    coverImgUrl,
    picUrl: coverImgUrl,
    trackCount,
    playCount: raw.listennum || raw.listen_num || raw.listenNum || 0,
    description: raw.desc || raw.introduction || raw.rcmdcontent || '',
    createTime: raw.ctime ? raw.ctime * 1000 : Date.parse(raw.createtime || '') || Date.now(),
    creator: {
      nickname: creatorName,
      userId: raw.uin || raw.creator || '',
    },
    followed: false,
    type: 'playlist',
  }
}

export function normalizeAlbum(raw = {}) {
  const mid = raw.albummid || raw.albumMid || raw.mid || raw.pmid || ''
  const id = mid || String(raw.albumid || raw.albumID || raw.id || '')
  const name = raw.albumname || raw.albumName || raw.name || raw.title || '未知专辑'
  const picUrl = raw.picUrl || raw.imgurl || albumCover(mid)
  const artists = pickSingers(raw.singers || raw.singer || raw.singerName)

  return {
    id,
    mid,
    name,
    picUrl,
    blurPicUrl: picUrl,
    artist: artists[0] || { id: '', name: '未知歌手' },
    artists,
    size: raw.cur_song_num || raw.totalNum || raw.size || 0,
    publishTime: Date.parse(raw.aDate || raw.publicTime || raw.publishDate || raw.release_time || '') || 0,
    description: raw.desc || '',
    company: raw.company || raw.company_new?.name || '',
    followed: false,
    type: 'album',
  }
}

export function normalizeArtist(raw = {}) {
  const mid = raw.singerMID || raw.singermid || raw.singerMid || raw.mid || raw.id || ''
  const name = raw.singerName || raw.singername || raw.name || raw.title || '未知歌手'
  const picUrl = raw.singerPic || raw.picUrl || raw.img1v1Url || singerCover(mid)

  return {
    id: mid,
    mid,
    name,
    picUrl,
    img1v1Url: picUrl,
    albumSize: raw.albumNum || raw.album_num || 0,
    musicSize: raw.songNum || raw.song_num || 0,
    mvSize: raw.mvNum || 0,
    followed: false,
    follow: { fansCnt: raw.fans || raw.num || 0 },
    briefDesc: raw.desc || raw.briefDesc || '',
    type: 'artist',
  }
}

export function normalizeRank(raw = {}) {
  const id = String(raw.id || raw.topId || '')
  const listenCount = raw.listenCount || raw.listenNum || raw.listennum || 0
  return {
    id,
    name: raw.topTitle || raw.title || raw.name || '排行榜',
    coverImgUrl: raw.picUrl || raw.cover || '',
    picUrl: raw.picUrl || raw.cover || '',
    updateFrequency:
      raw.updateFrequency ||
      raw.updateTips ||
      raw.updateTime ||
      raw.period ||
      (listenCount ? `${listenCount} 人收听` : ''),
    description: raw.intro || '',
    playCount: listenCount,
    type: 'rank',
  }
}

export function qqAvatarUrl(uin, size = 100) {
  const id = String(uin || '').replace(/^o/, '')
  if (!id) return ''
  const s = [40, 100, 140, 640].includes(Number(size)) ? Number(size) : 100
  return `https://thirdqq.qlogo.cn/g?b=qq&nk=${id}&s=${s}`
}

export function normalizeUserProfile(session = {}, avatarUrl = '') {
  const uin = String(session.uin || session.loginUin || '').replace(/^o/, '')
  const safeAvatar =
    avatarUrl && !/headimg_dl/i.test(avatarUrl) ? avatarUrl : qqAvatarUrl(uin, 100)
  return {
    userId: uin,
    userName: session.nick || session.nickname || uin,
    nickname: session.nick || session.nickname || uin,
    avatarUrl: safeAvatar || qqAvatarUrl(uin, 100),
    vipType: 0,
    signature: '',
  }
}

export function mapQuality(level) {
  const map = {
    standard: '128',
    higher: '192',
    exhigh: '320',
    lossless: 'flac',
    hires: 'flac',
    '128': '128',
    '192': '192',
    '320': '320',
    m4a: 'm4a',
    flac: 'flac',
  }
  return map[level] || '128'
}
