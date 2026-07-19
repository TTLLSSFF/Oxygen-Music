import pinia from '../store/pinia'
import { clearLoginCookies, isLogin } from '../utils/authority'
import { loadLastSong } from './player'
import { getUserProfile, getLikelist } from '../api/user'
import { useUserStore } from '../store/userStore'
import { usePlayerStore } from '../store/playerStore'
import { useLocalStore } from '../store/localStore'
import { storeToRefs } from 'pinia'
import { insertCustomFontStyle } from './setFont'
import { noticeOpen } from './dialog'

const userStore = useUserStore(pinia)
const playerStore = usePlayerStore()
const { quality, lyricSize, tlyricSize, rlyricSize, lyricInterludeTime } = storeToRefs(playerStore)
const localSotre = useLocalStore()
const { updateUser } = userStore

const DEFAULT_SETTINGS = {
  music: {
    level: 'standard',
    lyricSize: '20',
    tlyricSize: '14',
    rlyricSize: '12',
    lyricInterlude: 13,
  },
  local: {
    downloadFolder: '',
    localFolder: [],
  },
  other: {
    quitApp: 'minimize',
    customFont: '',
  },
}

function applySettings(settings) {
  const s = settings || DEFAULT_SETTINGS
  quality.value = s.music?.level || 'standard'
  lyricSize.value = s.music?.lyricSize || '20'
  tlyricSize.value = s.music?.tlyricSize || '14'
  rlyricSize.value = s.music?.rlyricSize || '12'
  lyricInterludeTime.value = s.music?.lyricInterlude || 13
  localSotre.downloadedFolderSettings = s.local?.downloadFolder || null
  localSotre.localFolderSettings = s.local?.localFolder || []
  localSotre.quitApp = s.other?.quitApp || 'minimize'
  if (s.other?.customFont) insertCustomFontStyle(s.other.customFont)
}

export const initSettings = () => {
  return new Promise((resolve) => {
    const finish = (settings) => {
      applySettings(settings)
      resolve()
    }

    try {
      const cached = localStorage.getItem('oxygen_settings')
      if (cached) {
        finish(JSON.parse(cached))
        return
      }
    } catch (_) {}

    const getter = window.windowApi?.getSettings
    if (getter) {
      Promise.resolve(getter())
        .then((settings) => finish(settings || DEFAULT_SETTINGS))
        .catch(() => finish(DEFAULT_SETTINGS))
    } else {
      finish(DEFAULT_SETTINGS)
    }
  })
}

export const getUserLikelist = () => {
  if (userStore.user && userStore.user.userId) {
    getLikelist(userStore.user.userId)
      .then((result) => {
        if (result && result.ids) {
          userStore.likelist = result.ids
        }
      })
      .catch(() => {
        userStore.likelist = []
      })
  } else {
    userStore.likelist = []
  }
}

export const initUserInfo = () => {
  return new Promise((resolve) => {
    if (isLogin()) {
      getUserProfile()
        .then((result) => {
          if (result && result.profile) {
            updateUser(result.profile)
            getUserLikelist()
          }
          resolve()
        })
        .catch(() => {
          noticeOpen('获取用户信息失败', 2)
          resolve()
        })
    } else {
      // 仅清理登录态，避免清空整个 localStorage 导致设置/播放列表丢失
      clearLoginCookies()
      userStore.user = null
      userStore.likelist = []
      resolve()
    }
  })
}

export const init = async () => {
  await initSettings()
  loadLastSong()
  await initUserInfo()
}
