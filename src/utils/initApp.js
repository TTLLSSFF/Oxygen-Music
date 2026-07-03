import pinia from '../store/pinia'
import { isLogin } from '../utils/authority'
import { loadLastSong } from './player'
import { scanMusic } from './locaMusic'
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

export const initSettings = () => {
    return new Promise((resolve) => {
        windowApi.getSettings().then(settings => {
            if (settings) {
                quality.value = settings.music.level
                lyricSize.value = settings.music.lyricSize
                tlyricSize.value = settings.music.tlyricSize
                rlyricSize.value = settings.music.rlyricSize
                lyricInterludeTime.value = settings.music.lyricInterlude
                localSotre.downloadedFolderSettings = settings.local.downloadFolder
                localSotre.localFolderSettings = settings.local.localFolder
                localSotre.quitApp = settings.other.quitApp
                if (localSotre.downloadedFolderSettings && !localSotre.downloadedMusicFolder) {
                    scanMusic({ type: 'downloaded', refresh: false })
                }
                if (localSotre.localFolderSettings.length != 0 && !localSotre.localMusicFolder) {
                    scanMusic({ type: 'local', refresh: false })
                }
                if (!localSotre.downloadedFolderSettings && localSotre.downloadedMusicFolder) {
                    localSotre.downloadedMusicFolder = null
                    localSotre.downloadedFiles = null
                    windowApi.clearLocalMusicData('downloaded')
                }
                if (localSotre.localFolderSettings.length == 0 && localSotre.localMusicFolder) {
                    localSotre.localMusicFolder = null
                    localSotre.localMusicList = null
                    localSotre.localMusicClassify = null
                    windowApi.clearLocalMusicData('local')
                }
                insertCustomFontStyle(settings.other.customFont)
            }
            // 设置未读取到配置时给默认值，避免 Web 模式下空值导致计算异常
            quality.value = quality.value || 'standard'
            lyricSize.value = lyricSize.value || '20'
            tlyricSize.value = tlyricSize.value || '14'
            rlyricSize.value = rlyricSize.value || '12'
            lyricInterludeTime.value = lyricInterludeTime.value || 13
            resolve()
        }).catch(() => {
            quality.value = quality.value || 'standard'
            lyricSize.value = lyricSize.value || '20'
            tlyricSize.value = tlyricSize.value || '14'
            rlyricSize.value = rlyricSize.value || '12'
            lyricInterludeTime.value = lyricInterludeTime.value || 13
            resolve()
        })
    })
}

export const getUserLikelist = () => {
    if (userStore.user && userStore.user.userId) {
        getLikelist(userStore.user.userId).then(result => {
            if (result && result.ids) {
                userStore.likelist = result.ids
            }
        }).catch(() => {
            userStore.likelist = []
        })
    } else {
        userStore.likelist = []
    }
}

export const initUserInfo = () => {
    return new Promise((resolve) => {
        if (isLogin()) {
            getUserProfile().then(result => {
                if (result && result.profile) {
                    updateUser(result.profile)
                    getUserLikelist()
                }
                resolve()
            }).catch(() => {
                noticeOpen("获取用户信息失败", 2)
                resolve()
            })
        } else {
            window.localStorage.clear()
            resolve()
        }
    })
}

export const init = async () => {
    await initSettings()
    loadLastSong()
    await initUserInfo()
}
