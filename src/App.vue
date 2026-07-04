<script setup>
  import Home from './views/Home.vue'
  import Title from './components/Title.vue'
  import SearchInput from './components/SearchInput.vue'
  import WindowControl from './components/WindowControl.vue'
  import MusicWidget from './components/MusicWidget.vue'
  import MusicPlayer from './views/MusicPlayer.vue'
  import VideoPlayer from './components/VideoPlayer.vue'
  import ContextMenu from './components/ContextMenu.vue'
  import GlobalDialog from './components/GlobalDialog.vue'
  import GlobalNotice from './components/GlobalNotice.vue'
  import Update from './components/Update.vue'

  import { usePlayerStore } from './store/playerStore'
  import { useOtherStore } from './store/otherStore'

  const isWeb = import.meta.env.MODE === 'web'

  const playerStore = usePlayerStore()
  const otherStore = useOtherStore()

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  windowApi.checkUpdate((event, version) => {
    otherStore.toUpdate = true
    otherStore.newVersion = version
  })
</script>

<template>
  <div class="mainWindow">
    <Transition name="home">
      <Home class="home" v-show="playerStore.widgetState"></Home>
    </Transition>
  </div>
  <div class="globalWidget">
    <Title class="widget-title"></Title>
    <SearchInput class="widget-search"></SearchInput>
  </div>
  <div class="dragBar" v-if="!isWeb">
    <WindowControl class="window-control"></WindowControl>
  </div>
  <div class="web-fullscreen" v-if="isWeb" @click="toggleFullscreen()">
    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path d="M128.576377 895.420553 128.576377 128.578424l766.846222 0 0 766.842129L128.576377 895.420553zM799.567461 224.434585 224.432539 224.434585l0 575.134923 575.134923 0L799.567461 224.434585z" p-id="1188"></path></svg>
  </div>
  <Transition name="widget">
    <div class="musicWidget" v-if="playerStore.songList" v-show="playerStore.widgetState">
      <MusicWidget></MusicWidget>
    </div>
  </Transition>
  <Transition name="player">
    <div class="musicPlayer" v-if="playerStore.songList" v-show="!playerStore.widgetState">
      <MusicPlayer></MusicPlayer>
    </div>
  </Transition>
  <Transition name="video">
    <div class="videoPlayer" v-if="otherStore.videoPlayerShow">
      <VideoPlayer></VideoPlayer>
    </div>
  </Transition>
  <div class="contextMune">
    <ContextMenu></ContextMenu>
  </div>
  <div class="globalDialog">
    <GlobalDialog></GlobalDialog>
  </div>
  <div class="globalNotice">
    <GlobalNotice></GlobalNotice>
  </div>
  <Transition name="fade">
    <div class="update" v-if="otherStore.toUpdate">
      <Update></Update>
    </div>
  </Transition>
</template>

<style lang="scss">
  #app{
    user-select: none;
    margin: 0;
    padding: 0;
    max-width: 100%;
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .mainWindow{
    width: 100%;
    height: 100%;
    background: linear-gradient(rgba(176, 209, 217, 0.9) -20%,rgba(176, 209, 217, 0.4) 50%,rgba(176, 209, 217, 0.9) 120%);
    opacity: 0;
    animation: mainWindows-starting 0.8s cubic-bezier(.14,.91,.58,1) forwards;
    @keyframes mainWindows-starting {
      0%{background-color: rgba(222, 235, 239, 1);opacity: 0;transform: scale(1.3);}
      100%{background-color: rgb(255, 255, 255);opacity: 1;transform: scale(1);}
    }
    .home{
      height: calc(100% - 78Px);
    }
  }
  .globalWidget{
    display: flex;
    flex-direction: row;
    align-items: center;
    position: absolute;
    top: 22Px;
    left: 45Px;
    z-index: 999;
    .widget-title{
      &:hover{
        cursor: pointer;
      }
    }
    .widget-search{
      margin-left: 30Px;
    }
  }
  .dragBar{
    width: 100%;
    height: 35Px;
    background: transparent;
    position: fixed;
    top: 0;
    z-index: 999;
    -webkit-app-region: drag;
    .window-control{
      position: fixed;
      top: 13Px;
      right: 15Px;
      -webkit-app-region: no-drag;
      z-index: 999;
    }
  }
  .web-fullscreen{
    position: fixed;
    top: 13Px;
    right: 15Px;
    z-index: 999;
    opacity: 0.5;
    transition: 0.3s;
    cursor: pointer;
    svg{
      width: 18Px;
      height: 18Px;
    }
    &:hover{
      opacity: 1;
    }
  }
  .musicWidget{
    width: 680Px;
    height: 65Px;
    position: fixed;
    left: 50%;
    bottom: 35Px;
    transform: translateX(-50%);
    box-shadow: 0 0 15Px 2Px rgba(189, 189, 189, 0.1);
  }
  .musicPlayer{
    width: 100%;  
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
  .videoPlayer{
    width: 100%;
    height: 100%;
    position: fixed;
    pointer-events: none;
    z-index: 999;
  }
  .globalNotice{
    bottom: 120Px;
    position: fixed;
    z-index: 999;
  }
  .update{
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.1);
    position: fixed;
    z-index: 999;
  }

  .home-enter-active,
  .home-leave-active {
    transition: 0.4s cubic-bezier(.14,.91,.58,1);
  }

  .home-enter-from,
  .home-leave-to {
    transform: scale(0.9);
    opacity: 0;
  }

  .widget-enter-active,
  .widget-leave-active {
    transition: 0.5s cubic-bezier(.14,.91,.58,1);
  }

  .widget-enter-from,
  .widget-leave-to {
    bottom: -70Px;
  }

  .player-enter-active,
  .player-leave-active {
    transition: 0.5s cubic-bezier(.14,.91,.58,1);
  }

  .player-enter-from,
  .player-leave-to {
    transform: translateY(100%);
  }
  .video-enter-active,
  .video-leave-active {
    transition: 0.1s;
  }

  .video-enter-from,
  .video-leave-to {
    transform: scale(0.8);
    opacity: 0;
  }
  .fade-enter-active {
    transition: 0.4s;
  }
  .fade-leave-active {
    transition: 0.3s;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
