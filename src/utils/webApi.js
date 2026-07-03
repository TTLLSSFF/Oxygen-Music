// Web 环境降级 shim：当页面不在 Electron 中运行时，
// 提供一个与 preload 暴露的 windowApi 签名兼容的空实现，
// 避免调用 Electron 专属 API 时直接报错。
const noop = () => {}
const noopCallback = () => {}
const resolveNull = () => Promise.resolve(null)
const resolveFalse = () => Promise.resolve(false)

const webApi = {
    windowMin: noop,
    windowMax: noop,
    windowClose: noop,
    toRegister: noop,
    beforeQuit: noopCallback,
    exitApp: noop,
    startDownload: noop,
    download: noop,
    downloadNext: noopCallback,
    downloadProgress: noopCallback,
    downloadPause: noop,
    downloadResume: noop,
    downloadCancel: noop,
    lyricControl: noopCallback,
    scanLocalMusic: noop,
    localMusicFiles: noopCallback,
    localMusicCount: noopCallback,
    getLocalMusicImage: resolveNull,
    playOrPauseMusic: noopCallback,
    playOrPauseMusicCheck: noop,
    lastOrNextMusic: noopCallback,
    changeMusicPlaymode: noopCallback,
    changeTrayMusicPlaymode: noop,
    changeHeartMode: noopCallback,
    volumeUp: noopCallback,
    volumeDown: noopCallback,
    musicProcessControl: noopCallback,
    hidePlayer: noopCallback,
    setSettings: noop,
    getSettings: resolveNull,
    openFile: resolveNull,
    clearLocalMusicData: noop,
    registerShortcuts: noop,
    unregisterShortcuts: noop,
    getLastPlaylist: resolveNull,
    openLocalFolder: noop,
    saveLastPlaylist: noop,
    getRequestData: resolveNull,
    getBiliVideo: resolveNull,
    downloadVideoProgress: noopCallback,
    cancelDownloadMusicVideo: noop,
    musicVideoIsExists: resolveFalse,
    clearUnusedVideo: noop,
    deleteMusicVideo: noop,
    getLocalMusicLyric: resolveNull,
    copyTxt: noop,
    selectFile: resolveNull,
    checkUpdate: noopCallback,
    setWindowTile: noop,
}

if (typeof window !== 'undefined' && !window.windowApi) {
    window.windowApi = webApi
}

export default webApi
