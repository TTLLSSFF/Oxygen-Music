import pinia from '../store/pinia'
import { Howl, Howler } from 'howler'
import { noticeOpen } from './dialog'
import { checkMusic, getMusicUrl, likeMusic, getLyric } from '../api/song'
import { getLikelist } from '../api/user'
import { useUserStore } from '../store/userStore'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { useOtherStore } from '../store/otherStore'
import { storeToRefs } from 'pinia'
import { isLogin } from './authority'

const otherStore = useOtherStore()
const userStore = useUserStore()
const libraryStore = useLibraryStore(pinia)
const playerStore = usePlayerStore(pinia)
const { libraryInfo } = storeToRefs(libraryStore)
const {
  currentMusic,
  playing,
  progress,
  volume,
  quality,
  playMode,
  songList,
  shuffledList,
  shuffleIndex,
  listInfo,
  songId,
  currentIndex,
  time,
  playlistWidgetShow,
  playerChangeSong,
  lyric,
  lyricsObjArr,
  lyricShow,
  lyricEle,
  isLyricDelay,
  widgetState,
  localBase64Img,
  musicVideo,
  currentMusicVideo,
  musicVideoDOM,
  videoIsPlaying,
  playerShow,
  lyricBlur,
  coverUrl,
} = storeToRefs(playerStore)

// 旧版本心动模式为 playMode 4，迁移为单次触发
if (playMode.value === 4) {
  playMode.value = 0
}

let isProgress = false
let musicProgress = null
let loadLast = true
let playModeOne = false //为true代表顺序播放已全部结束
let currentTiming = null
let videoCheckInterval = null

function api() {
  return typeof window !== 'undefined' && window.windowApi ? window.windowApi : null
}

function persistPlaylist() {
  try {
    const list = {
      songList: songList.value,
      shuffledList: shuffledList.value,
    }
    localStorage.setItem('oxygen_last_playlist', JSON.stringify(list))
    api()?.saveLastPlaylist?.(JSON.stringify(list))
  } catch (_) {}
}

function clampProgress() {
  const t = Number(time.value) || 0
  if (Number(progress.value) > t) progress.value = t
  if (Number(progress.value) < 0) progress.value = 0
}

export function loadLastSong() {
  if (!loadLast) return
  const apply = (list) => {
    if (list) {
      songList.value = list.songList
      shuffledList.value = list.shuffledList
    }
    if (
      songList.value &&
      songList.value.length > 0 &&
      currentIndex.value >= 0 &&
      currentIndex.value < songList.value.length
    ) {
      if (songList.value[currentIndex.value].type == 'local')
        getSongUrl(songList.value[currentIndex.value].id, currentIndex.value, false, true)
      else getSongUrl(songList.value[currentIndex.value].id, currentIndex.value, false, false)
      if (musicVideo.value) loadMusicVideo(songList.value[currentIndex.value].id)
    }
    clampProgress()
  }

  const fromApi = api()?.getLastPlaylist?.()
  if (fromApi && typeof fromApi.then === 'function') {
    fromApi
      .then((list) => {
        if (list) apply(list)
        else {
          try {
            const raw = localStorage.getItem('oxygen_last_playlist')
            apply(raw ? JSON.parse(raw) : null)
          } catch (_) {
            apply(null)
          }
        }
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem('oxygen_last_playlist')
          apply(raw ? JSON.parse(raw) : null)
        } catch (_) {
          apply(null)
        }
      })
  } else {
    try {
      const raw = localStorage.getItem('oxygen_last_playlist')
      apply(raw ? JSON.parse(raw) : null)
    } catch (_) {
      apply(null)
    }
  }
}

export function play(url, autoplay) {
  if (currentMusic.value) {
    currentMusic.value.unload()
    Howler.unload()
  }
  currentMusic.value = new Howl({
    src: url,
    autoplay: autoplay,
    html5: true,
    preload: true,
    format: ['mp3', 'flac', 'm4a', 'aac'],
    loop: playMode.value == 2,
    volume: volume.value,
    xhr: {
      method: 'GET',
      withCredentials: false,
    },
    onend: function () {
      clearInterval(musicProgress)
      if (playMode.value == 0 && currentIndex.value < songList.value.length - 1) {
        playNext()
        return
      } //顺序播放
      if (playMode.value == 0 && currentIndex.value == songList.value.length - 1) {
        playing.value = false
        playModeOne = true
        api()?.playOrPauseMusicCheck?.(playing.value)
        return
      } //顺序播放结束暂停状态
      if (playMode.value == 1) {
        playNext()
        return
      } //列表循环
      if (playMode.value == 3) {
        playNext()
      } //随机播放(为列表循环)
      if (playMode.value == 2) {
        clearLycAnimation()
      } // 单曲循环播放结束时清除歌词动画
    },
  })
  currentMusic.value.once('load', () => {
    time.value = Math.floor(currentMusic.value.duration())
    clampProgress()
    if (loadLast) {
      currentMusic.value.volume(0)
      currentMusic.value.seek(progress.value)
      loadLast = false
    }
    playerChangeSong.value = false
  })
  currentMusic.value.on('play', () => {
    currentMusic.value.fade(0, volume.value, 200)
    startProgress()
    playing.value = true
    api()?.playOrPauseMusicCheck?.(playing.value)
  })
  currentMusic.value.on('pause', () => {
    clearInterval(musicProgress)
    playing.value = false
    api()?.playOrPauseMusicCheck?.(playing.value)
    currentMusic.value.fade(volume.value, 0, 200)
  })
}

export function startProgress() {
  clearInterval(musicProgress)
  progress.value = currentMusic.value.seek()
  musicProgress = setInterval(() => {
    if (currentMusic.value.seek() < time.value) progress.value = currentMusic.value.seek()
  }, 1000)
}

export function setId(id, index) {
  if (playMode.value != 3) {
    songId.value = id
    currentIndex.value = index
  } else {
    songId.value = id
    shuffleIndex.value = index
    currentIndex.value = (songList.value || []).findIndex((song) => song.id === songId.value)
  }
}

export function addToList(listType, songlist) {
  listInfo.value = {
    id: listType == 'rec' ? 'rec' : libraryInfo.value ? libraryInfo.value.id : 'none',
    type: listType,
  }
  songList.value = songlist.slice(0, songlist.length + 1)
  savePlaylist()
}

export function localMusicHandle(list, isToNext) {
  let addList = []
  list.forEach((song) => {
    let ar = []
    if (song.common.artists)
      song.common.artists.forEach((artist) => {
        ar.push({
          id: 'local',
          name: artist,
        })
      })
    else {
      ar.push({
        id: 'local',
        name: 'NONE',
      })
    }
    addList.push({
      id: song.id,
      ar: ar,
      url: song.dirPath,
      name: song.common.title,
      localName: song.common.localTitle,
      type: 'local',
      sampleRate: song.format.sampleRate / 1000,
      bitsPerSample: song.format.bitsPerSample,
      bitrate: Math.round(song.format.bitrate / 1000),
    })
  })
  if (isToNext) return addList[0]
  return addList
}

export function addLocalMusicTOList(listType, localMusicList, playId, playIndex) {
  listInfo.value = {
    id: 'local',
    type: listType,
  }

  songList.value = localMusicHandle(localMusicList, false)
  addSong(playId, playIndex, true, true)
  savePlaylist()
}
export function startLocalMusicVideo() {
  clearInterval(videoCheckInterval)
  videoCheckInterval = setInterval(() => {
    musicVideoCheck(currentMusic.value.seek())
  }, 200)
}
export function unloadMusicVideo() {
  currentMusicVideo.value = null
  videoIsPlaying.value = false
  playerShow.value = true
}
export function loadMusicVideo(id) {
  if (currentMusicVideo.value) unloadMusicVideo()
  const checker = api()?.musicVideoIsExists
  if (!checker) {
    unloadMusicVideo()
    return
  }
  checker({ id: id, method: 'verify' }).then((result) => {
    if (result == '404') {
      videoCheckInterval = null
      noticeOpen('未找到视频文件', 2)
      unloadMusicVideo()
    } else if (result) {
      currentMusicVideo.value = result.data
      if (songList.value[currentIndex.value].type == 'local') startLocalMusicVideo()
    } else {
      videoCheckInterval = null
      unloadMusicVideo()
    }
  })
}

export function addSong(id, index, autoplay, isLocal) {
  progress.value = 0
  if (lyricShow.value) {
    lyricShow.value = false
    playerChangeSong.value = true
  }
  setId(id, index)
  if (musicVideo.value) loadMusicVideo(id)

  if (songList.value[currentIndex.value].type == 'local') isLocal = true
  else isLocal = false

  if (currentMusic.value && volume.value != 0) {
    currentMusic.value.fade(volume.value, 0, 200)
    currentMusic.value.once('fade', () => {
      getSongUrl(id, index, autoplay, isLocal)
      return
    })
    if (currentMusic.value.state() == 'loading' || currentMusic.value.state() == 'unloaded') {
      currentMusic.value.unload()
      getSongUrl(id, index, autoplay, isLocal)
    }
  } else {
    getSongUrl(id, index, autoplay, isLocal)
  }
}

export function setSongLevel(level) {
  if (level == 'standard') songList.value[currentIndex.value].level = songList.value[currentIndex.value].l
  else if (level == 'higher') songList.value[currentIndex.value].level = songList.value[currentIndex.value].m
  else if (level == 'exhigh') songList.value[currentIndex.value].level = songList.value[currentIndex.value].h
  else if (level == 'lossless') songList.value[currentIndex.value].level = songList.value[currentIndex.value].sq
  else if (level == 'hires') songList.value[currentIndex.value].level = songList.value[currentIndex.value].hr
  songList.value[currentIndex.value].quality = level
}
export async function getLocalLyric(filePath) {
  const lyric = await api()?.getLocalMusicLyric?.(filePath)
  if (lyric) return lyric
  else return false
}
export function setSongToWindows() {
  if (songList.value[currentIndex.value].type != 'local') {
    coverUrl.value = (songList.value[currentIndex.value].al?.picUrl || '') + (songList.value[currentIndex.value].al?.picUrl?.includes('?') ? '' : '?param=128y128')
  } else {
    if (!localBase64Img.value) coverUrl.value = null
    else coverUrl.value = localBase64Img.value
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: [songList.value[currentIndex.value].name],
      artist: [songList.value[currentIndex.value].ar.map((a) => a.name)],
      artwork: [{ src: coverUrl.value }],
    })
  }
}
let playRequestToken = 0

export async function getSongUrl(id, index, autoplay, isLocal) {
  const token = ++playRequestToken
  const song = songList.value[currentIndex.value]
  api()?.setWindowTile?.((song?.name || '') + ' - ' + (song?.ar?.[0]?.name || ''))
  if (isLocal) {
    api()
      ?.getLocalMusicImage?.(song.url)
      ?.then((base64) => {
        localBase64Img.value = base64
        setSongToWindows()
      })
    play(song.url, autoplay)
    lyric.value = null
    lyricsObjArr.value = null
    const localLyric = await getLocalLyric(song.url)
    if (localLyric) {
      lyric.value = { lrc: { lyric: localLyric } }
    }
    if (!lyricShow.value && !widgetState.value) {
      lyricShow.value = true
      playerChangeSong.value = false
    }
    return
  }
  setSongToWindows()
  const mid = song?.songmid || song?.mid || song?.id || id
  lyric.value = null
  lyricsObjArr.value = null

  const lyricPromise = getLyric(mid)
    .then((songLiric) => {
      if (token !== playRequestToken) return
      lyric.value = songLiric
    })
    .catch(() => {
      if (token !== playRequestToken) return
      lyric.value = { lrc: { lyric: '' } }
    })

  try {
    const result = await checkMusic(mid)
    if (token !== playRequestToken) return
    if (result.success == true) {
      const songInfo = await getMusicUrl(mid, quality.value || 'standard')
      if (token !== playRequestToken) return
      const url = songInfo.data && songInfo.data[0] && songInfo.data[0].url
      if (url) {
        play(url, autoplay)
        setSongLevel(songInfo.data[0].level || quality.value)
      } else {
        if (!isLogin()) noticeOpen('暂无播放链接，请先扫码登录 QQ 音乐', 3)
        else noticeOpen(songInfo.data?.[0]?.msg || '当前歌曲无法播放', 2)
        clearInterval(musicProgress)
        playing.value = false
        currentMusic.value = null
      }
      await lyricPromise
    } else {
      noticeOpen('当前歌曲无法播放', 2)
      clearInterval(musicProgress)
      playing.value = false
      currentMusic.value = null
      lyric.value = null
    }
  } catch (e) {
    if (token !== playRequestToken) return
    const aborted = e?.code === 'ERR_CANCELED' || /aborted|cancel/i.test(String(e?.message || ''))
    if (!aborted) noticeOpen('获取播放地址失败', 2)
    clearInterval(musicProgress)
    playing.value = false
  }
}

export function startMusic() {
  if (!currentMusic.value) {
    const list = playMode.value == 3 ? shuffledList.value : songList.value
    const index = playMode.value == 3 ? shuffleIndex.value : currentIndex.value
    const song = Array.isArray(list) ? list[index] : null
    if (song) addSong(song.songmid || song.mid || song.id, index, true)
    else noticeOpen('暂无可播放歌曲', 2)
    return
  }
  if (
    playMode.value == 0 &&
    currentIndex.value == songList.value.length - 1 &&
    playModeOne &&
    currentMusic.value.seek?.() == 0
  ) {
    playNext()
    playModeOne = false
    return
  }
  if (!playing.value) {
    currentMusic.value.play?.()
  }
  if (lyricShow.value) {
    isLyricDelay.value = false
    const forbidDelayTimer = setTimeout(() => {
      isLyricDelay.value = true
      clearTimeout(forbidDelayTimer)
    }, 700)
  }
  if (videoIsPlaying.value) {
    musicVideoDOM.value.play()
    if (songList.value[currentIndex.value].type == 'local') startLocalMusicVideo()
  }
}
export function pauseMusic() {
  clearInterval(musicProgress)
  if (playing.value && currentMusic.value) {
    currentMusic.value.fade(volume.value, 0, 200)
    currentMusic.value.once('fade', () => {
      currentMusic.value?.pause?.()
      playing.value = false
    })
  } else {
    playing.value = false
  }
  if (videoIsPlaying.value) {
    musicVideoDOM.value.pause()
    if (songList.value[currentIndex.value].type == 'local') clearInterval(videoCheckInterval)
  }
}

export function playLast() {
  let id = null
  let index = null
  if (playMode.value != 3) {
    if (currentIndex.value - 1 < 0) {
      index = songList.value.length - 1
      id = songList.value[index].id
    } else {
      id = songList.value[currentIndex.value - 1].id
      index = currentIndex.value - 1
    }
  }
  if (playMode.value == 3) {
    if (shuffleIndex.value - 1 < 0) {
      index = shuffledList.value.length - 1
      id = shuffledList.value[index].id
    } else {
      index = shuffleIndex.value - 1
      id = shuffledList.value[index].id
    }
  }
  addSong(id, index, true)
}
export function playNext() {
  let id = null
  let index = null
  if (playMode.value != 3) {
    if (songList.value.length - 1 == currentIndex.value) {
      index = 0
      id = songList.value[index].id
    } else {
      index = currentIndex.value + 1
      id = songList.value[index].id
    }
  }
  if (playMode.value == 3) {
    if (shuffleIndex.value == shuffledList.value.length - 1) {
      index = 0
      id = shuffledList.value[index].id
    } else {
      index = shuffleIndex.value + 1
      id = shuffledList.value[index].id
    }
  }
  addSong(id, index, true)
}
const clearLycAnimation = () => {
  isLyricDelay.value = false
  for (let i = 0; i < lyricEle.value.length; i++) {
    lyricEle.value[i].style.transitionDelay = 0 + 's'
    if (lyricBlur.value) lyricEle.value[i].firstChild.style.setProperty('filter', 'blur(0)')
  }
  const forbidDelayTimer = setTimeout(() => {
    isLyricDelay.value = true
    clearTimeout(forbidDelayTimer)
  }, 600)
}
export function changeProgress(toTime) {
  if (!currentMusic.value) return
  if (!widgetState.value && lyricShow.value && lyricEle.value) clearLycAnimation()
  if (videoIsPlaying.value) {
    musicVideoCheck(toTime, true)
  }
  currentMusic.value.seek(toTime)
}
//控制拖拽进度条
export function changeProgressByDragStart() {
  clearInterval(musicProgress)
}
export function changeProgressByDragEnd(toTime) {
  changeProgress(toTime)
  if (playing.value) startProgress()
}
// ------------
export async function changePlayMode() {
  playMode.value = (playMode.value + 1) % 4

  if (currentMusic.value) {
    if (playMode.value == 2) currentMusic.value.loop(true)
    else currentMusic.value.loop(false)
  }
  if (playMode.value == 3) {
    setShuffledList()
  } else {
    shuffledList.value = null
    shuffleIndex.value = null
  }
  api()?.changeTrayMusicPlaymode?.(playMode.value)
}

export async function toggleHeartMode() {
  await enterHeartMode()
}

export function playAll(listType, list) {
  if (playMode.value == 3) {
    addToList(listType, list)
    setShuffledList(true)
    addSong(shuffledList.value[0].id, 0, true)
  } else {
    addToList(listType, list)
    addSong(songList.value[0].id, 0, true)
  }
}

export function setShuffledList(isplayAll) {
  shuffledList.value = shuffle(songList.value, isplayAll)
  shuffleIndex.value = 0
}

function shuffle(arr, isplayAll) {
  // 随机打乱数组
  let _arr = arr.slice()
  for (let i = 0; i < _arr.length; i++) {
    let j = getRandomInt(0, i)
    let t = _arr[i]
    _arr[i] = _arr[j]
    _arr[j] = t
  }
  if (!isplayAll) {
    let currentSongIndex = (_arr || []).findIndex((song) => song.id === songId.value)
    _arr.splice(currentSongIndex, 1)
    _arr.unshift(songList.value[currentIndex.value])
  }
  return _arr
}
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

async function enterHeartMode() {
  noticeOpen('QQ 音乐源暂不支持心动模式', 2)
  return false
}

export function likeSong(like) {
  likeMusic(songId.value, like).then((result) => {
    if (result.code == 200) {
      if (userStore.user?.userId) {
        getLikelist(userStore.user.userId)
          .then((res) => {
            userStore.likelist = res.ids
          })
          .catch(() => {})
      }
      otherStore.addPlaylistShow = false
      noticeOpen(result.message || '已处理', 2)
    } else {
      noticeOpen('喜欢/取消喜欢 音乐失败！', 2)
    }
  })
}

export function addToNext(nextSong, autoplay) {
  if (!songList.value) songList.value = []
  if (nextSong.id == songId.value) return

  const si = (songList.value || []).findIndex((song) => song.id === nextSong.id)
  if (si != -1) {
    songList.value.splice(si, 1)
    if (si < currentIndex.value) currentIndex.value--
  }
  songList.value.splice(currentIndex.value + 1, 0, nextSong)

  if (playMode.value == 3) {
    const shufflei = (shuffledList.value || []).findIndex((song) => song.id === nextSong.id)
    if (shufflei != -1) {
      shuffledList.value.splice(shufflei, 1)
      if (shufflei < currentIndex.value) shuffleIndex.value--
    }
    shuffledList.value.splice(shuffleIndex.value + 1, 0, nextSong)
  }
  if (autoplay) playNext()
  else noticeOpen('已添加至下一首', 2)
  if (songList.value.length == 1) addSong(nextSong.id, 0, autoplay)
  savePlaylist()
}
export function addToNextLocal(song, autoplay) {
  addToNext(localMusicHandle([song], true), autoplay)
}
export function savePlaylist() {
  persistPlaylist()
}
export function songTime(dt) {
  if (dt == 0 || dt == '--' || dt == null || dt === undefined) return dt || '0:00'
  const totalSec = Math.floor(Number(dt) / 1000)
  if (!Number.isFinite(totalSec) || totalSec < 0) return '0:00'
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min + ':' + String(sec).padStart(2, '0')
}
export function songTime2(time) {
  let min = Math.floor(time / 60)
  let sec = Math.floor(time % 60)
  if (sec == 60) {
    sec = 0
    min++
  }
  if (min < 10) min = '0' + min
  if (sec < 10) sec = '0' + sec
  return min + ':' + sec
}
/**
 * 音乐视频监测
 */
export function musicVideoCheck(seek, update) {
  if ((musicVideo.value && currentMusicVideo.value && !videoIsPlaying.value) || update) {
    for (let i = 0; i < currentMusicVideo.value.timing.length; i++) {
      if (seek >= currentMusicVideo.value.timing[i].start && seek < currentMusicVideo.value.timing[i].end) {
        if (playing.value) musicVideoDOM.value.play()
        const vt = currentMusicVideo.value.timing[i].videoTiming + seek - currentMusicVideo.value.timing[i].start
        musicVideoDOM.value.currentTime = vt
        if (Math.abs(musicVideoDOM.value.currentTime - vt) > 1) return
        currentTiming = currentMusicVideo.value.timing[i]
        videoIsPlaying.value = true
        if (!update) playerShow.value = false
        return
      }
    }
    videoIsPlaying.value = false
    playerShow.value = true
    musicVideoDOM.value.pause()
  } else if (videoIsPlaying.value && currentTiming) {
    if (seek > currentTiming.end) {
      videoIsPlaying.value = false
      playerShow.value = true
      currentTiming = null
    }
  }
}

window.addEventListener('mousedown', (e) => {
  if (e.target.parentNode.parentNode.id == 'widget-progress') {
    changeProgressByDragStart()
    isProgress = true
  }
})

window.addEventListener('mouseup', () => {
  if (isProgress) {
    changeProgressByDragEnd(progress.value)
    isProgress = false
  }
})

window.addEventListener('click', (e) => {
  if (playlistWidgetShow.value) {
    if (
      document.getElementsByClassName('playlist-widget')[0]?.contains(e.target) == false &&
      document.getElementsByClassName('music-control')[0]?.contains(e.target) == false &&
      document.getElementsByClassName('music-other')[0]?.contains(e.target) == false &&
      document.getElementsByClassName('playlist-widget-player')[0]?.contains(e.target) == false &&
      document.getElementsByClassName('song-control')[0]?.contains(e.target) == false &&
      document.getElementsByClassName('contextMune')[0]?.contains(e.target) == false &&
      e.target.className.baseVal != 'item-delete'
    )
      playlistWidgetShow.value = false
  }
  if (otherStore.contextMenuShow) otherStore.contextMenuShow = false
  if (
    !otherStore.videoIsBlur &&
    otherStore.videoPlayerShow &&
    document.getElementById('videoPlayer')?.contains(e.target) == false
  )
    otherStore.videoIsBlur = true
  else if (
    otherStore.videoIsBlur &&
    otherStore.videoPlayerShow &&
    document.getElementById('videoPlayer')?.contains(e.target) == true &&
    document.getElementsByClassName('plyr__controls')[0]?.contains(e.target) != true
  )
    otherStore.videoIsBlur = false
  if (userStore.appOptionShow && document.getElementsByClassName('user-head')[0]?.contains(e.target) != true)
    userStore.appOptionShow = false
})

const w = api()
if (w) {
  w.playOrPauseMusic?.((event) => {
    if (playing.value) pauseMusic()
    else startMusic()
  })
  w.lastOrNextMusic?.((event, option) => {
    if (option == 'last') playLast()
    else if (option == 'next') playNext()
  })
  w.changeMusicPlaymode?.(async (event, mode) => {
    if (mode < 0 || mode > 3) return
    if (playMode.value != mode) playMode.value = mode
    if (currentMusic.value) {
      if (playMode.value == 2) currentMusic.value.loop(true)
      else currentMusic.value.loop(false)
    }
    if (playMode.value == 3) {
      setShuffledList()
    } else {
      shuffledList.value = null
      shuffleIndex.value = null
    }
    w.changeTrayMusicPlaymode?.(playMode.value)
  })
  w.changeHeartMode?.((event) => {
    toggleHeartMode()
  })
  w.volumeUp?.(() => {
    if (volume.value + 0.1 < 1) volume.value += 0.1
    else volume.value = 1
    currentMusic.value?.volume?.(volume.value)
  })
  w.volumeDown?.(() => {
    if (volume.value - 0.1 > 0) volume.value -= 0.1
    else volume.value = 0
    currentMusic.value?.volume?.(volume.value)
  })
  w.musicProcessControl?.((event, mode) => {
    if (!currentMusic.value) return
    if (mode == 'forward') {
      if (progress.value + 3 < currentMusic.value.duration()) progress.value += 3
      else progress.value = currentMusic.value.duration()
    } else if (mode == 'back') {
      if (progress.value - 3 > 0) progress.value -= 3
      else progress.value = 0
    }
    if (videoIsPlaying.value) {
      musicVideoCheck(progress.value, true)
    }
    currentMusic.value.seek(progress.value)
  })
  w.playOrPauseMusicCheck?.(playing.value)
  w.changeTrayMusicPlaymode?.(playMode.value)
  w.beforeQuit?.(() => {
    w.downloadPause?.('shutdown')
    let list = {
      songList: songList.value,
      shuffledList: shuffledList.value,
    }
    w.exitApp?.(JSON.stringify(list))
  })
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    playLast()
  })
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    playNext()
  })
  navigator.mediaSession.setActionHandler('play', () => {
    startMusic()
  })
  navigator.mediaSession.setActionHandler('pause', () => {
    pauseMusic()
  })
}
