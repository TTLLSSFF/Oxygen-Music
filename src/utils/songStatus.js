import pinia from '../store/pinia'
import { useUserStore } from '../store/userStore'
import { isLogin } from './authority'

const userStore = useUserStore(pinia)

function checkSongPlayable(song, _privilege) {
  let privilege = _privilege
  if (privilege === undefined) {
    privilege = song?.privilege
  }

  let status = {
    playable: true,
    reason: '',
  }

  // QQ 源：默认认为可请求播放；真正失败在取链时处理
  if (song?.type === 'qq' || song?.songmid) {
    if (!song.songmid && !song.id) {
      status.playable = false
      status.reason = '缺少歌曲标识'
    }
    return status
  }

  if (song?.privilege?.pl > 0) return status

  if (song.fee === 1 || privilege?.fee === 1) {
    status.vipOnly = true
    if (!(isLogin() && userStore.user?.vipType === 11)) {
      status.playable = false
      status.reason = '仅限 VIP 会员'
    }
  } else if ((song.fee === 4 || privilege?.fee === 4) && song?.st < 0) {
    status.playable = false
    status.reason = '付费专辑'
  } else if (song.noCopyrightRcmd !== null && song.noCopyrightRcmd !== undefined) {
    status.playable = false
    status.reason = '无版权'
  } else if (privilege?.st < 0 && isLogin()) {
    status.playable = false
    status.reason = '已下架'
  }
  return status
}

export function mapSongsPlayableStatus(songs, privilegeList = []) {
  if (songs?.length === undefined) return []

  if (privilegeList.length === 0) {
    return songs.map((song) => {
      Object.assign(song, { ...checkSongPlayable(song) })
      return song
    })
  }

  return songs.map((song, i) => {
    Object.assign(song, { ...checkSongPlayable(song, privilegeList[i]) })
    return song
  })
}
