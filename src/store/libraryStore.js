import { defineStore } from "pinia";
import { getPlaylistDetail, getPlaylistAll, getRecommendSongs, playlistDynamic } from '../api/playlist'
import { getAlbumDetail, albumDynamic } from '../api/album'
import { getArtistDetail, getArtistFansCount, getArtistTopSong, getArtistAlbum } from '../api/artist'
import { getArtistMV } from '../api/mv'
import { mapSongsPlayableStatus } from "../utils/songStatus";

function reportPlaylistDebug(event, payload = {}) {
    try {
        fetch('http://127.0.0.1:37901/log', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ event, payload }),
        }).catch(() => {})
    } catch (_) {}
}

export const useLibraryStore = defineStore('libraryStore', {
    state: () => {
        return {
            listType1: 0,
            listType2: 0,
            artistPageType: 0,
            libraryList: null,
            libraryListAlbum: null,
            libraryListAritist: null,
            playlistCount: null,
            playlistUserCreated: null,
            playlistUserSub: null,
            libraryInfo: null,
            librarySongs: null,
            libraryAlbum: null,
            libraryMV: null,
            needTimestamp: [],
            libraryChangeAnimation: false,
        }
    },
    actions: {
        changeAnimation() {
            this.libraryChangeAnimation = true
        },
        changeLibraryList(type) {
            if(type == 0) this.libraryList = this.playlistUserCreated
            else if (type == 1) this.libraryList = this.playlistUserSub
            reportPlaylistDebug('library-store-change-list', {
                type,
                createdLength: Array.isArray(this.playlistUserCreated) ? this.playlistUserCreated.length : null,
                subLength: Array.isArray(this.playlistUserSub) ? this.playlistUserSub.length : null,
                libraryLength: Array.isArray(this.libraryList) ? this.libraryList.length : null,
            })
        },
        updateLibrary(libraryData) {
            this.libraryData = libraryData
        },
        updateUserPlaylistCount(listCount) {
            this.playlistCount = listCount
        },
        updateUserPlaylist(playlist) {
            const list = Array.isArray(playlist) ? playlist.slice() : []
            const created = list.filter((item) => item.qqPlaylistType === 'created')
            const sub = list.filter((item) => item.qqPlaylistType !== 'created')
            const createdCount = this.playlistCount?.createdPlaylistCount ?? created.length
            const subCount = this.playlistCount?.subPlaylistCount ?? sub.length
            this.playlistUserCreated = created
            this.playlistUserSub = sub
            reportPlaylistDebug('library-store-update-user-playlist', {
                total: list.length,
                createdCount,
                subCount,
                createdLength: this.playlistUserCreated.length,
                subLength: this.playlistUserSub.length,
                sample: list.slice(0, 3).map((item) => ({ id: item.id, name: item.name, qqPlaylistType: item.qqPlaylistType, trackCount: item.trackCount })),
            })
        },
        async updateLibraryDetail(id, routerName) {
            this.changeAnimation()
            if(routerName == 'playlist') await this.updatePlaylistDetail(id)
            if(routerName == 'album') await this.updateAlbumDetail(id)
            if(routerName == 'artist') await this.updateArtistDetail(id)
            this.artistPageType = 0
            this.libraryAlbum = null
            this.libraryMV = null
        },
        async updatePlaylistDetail(id) {
            let params = {
                id: id,
                limit: 1000,
                offset: 0,
            }
            try {
                const results = await Promise.all([
                    getPlaylistDetail(params),
                    getPlaylistAll(params),
                    playlistDynamic(id),
                ])
                this.libraryInfo = results[0].playlist
                // QQ 歌单详情常已带完整 tracks，优先用 all 接口，否则回落 tracks
                const songs =
                    (results[1].songs && results[1].songs.length
                        ? results[1].songs
                        : results[0].playlist?.tracks) || []
                this.librarySongs = mapSongsPlayableStatus(songs, results[1].privileges || [])
                const trackIds = results[0].playlist?.trackIds || []
                if (trackIds.length > 1000) {
                    for (let i = 1; i < trackIds.length / 1000; i++) {
                        const pageParams = {
                            id: id,
                            limit: 1000,
                            offset: i * 1000,
                        }
                        const res = await getPlaylistAll(pageParams)
                        const pageSongs = mapSongsPlayableStatus(res.songs, res.privileges)
                        this.librarySongs = this.librarySongs.concat(pageSongs)
                    }
                }
                this.libraryInfo.followed = results[2].subscribed
            } catch (e) {
                console.error('加载歌单失败', e)
                this.libraryInfo = this.libraryInfo || { id, name: '加载失败', coverImgUrl: '' }
                this.librarySongs = []
            } finally {
                this.libraryChangeAnimation = false
            }
        },
        async updateAlbumDetail(id) {
            let params = {
                id: id,
                // timestamp: new Date().getTime()
            }
            await Promise.all([getAlbumDetail(params), albumDynamic(id)]).then(results => {
                this.libraryInfo = results[0].album
                this.librarySongs = mapSongsPlayableStatus(results[0].songs)
                this.libraryInfo.followed = results[1].isSub
                this.libraryChangeAnimation = false
            })
        },
        async updateArtistDetail(id) {
            let params = {
                id: id,
                // timestamp: new Date().getTime()
            }
            await Promise.all([getArtistDetail(params), getArtistFansCount(id)]).then(results => {
                results[0].artist.follow = results[1].data
                results[0].artist.followed = results[1].data.follow
                this.libraryInfo = results[0].artist
                this.librarySongs = mapSongsPlayableStatus(results[0].hotSongs)
                this.libraryChangeAnimation = false
            })
        },
        //获取歌手热门歌曲前50首，并更新Store数据
        async updateArtistTopSong(id) {
            let params = {
                id: id,
                // timestamp: new Date().getTime()
            }
            await getArtistTopSong(params).then(result => {
                this.librarySongs = mapSongsPlayableStatus(result.songs)
            })
        },
        //获取歌手专辑，并更新Store数据
        async updateArtistAlbum(id) {
            let params = {
                id: id,
                limit: 500,
                offset: 0
                // timestamp: new Date().getTime()
            }
            await getArtistAlbum(params).then(result => {
                this.libraryAlbum = result.hotAlbums
            })
        },
        //获取歌手MV，并更新Store数据
        async updateArtistsMV(id) {
            let params = {
                id: id,
                limit: 500,
                offset: 0
                // timestamp: new Date().getTime()
            }
            await getArtistMV(params).then(result => {
                this.libraryMV = result.mvs
            })
        },
        async updateRecommendSongs() {
            await getRecommendSongs().then(result => {
                this.librarySongs = mapSongsPlayableStatus(result.data.dailySongs)
            })
        },
    },
})
