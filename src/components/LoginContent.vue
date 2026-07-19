<script setup>
  import { onActivated, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import LoginByQRCode from './LoginByQRCode.vue'

  const router = useRouter()
  const loginByQR = ref(null)
  const jumpPage = ref(false)

  onActivated(() => {
    if (loginByQR.value) loginByQR.value.checkQR()
  })

  //登录成功跳转页面
  const jumpTo = () => {
    jumpPage.value = true
    const jumpDelay = setTimeout(() => {
      router.push('/mymusic')
      jumpPage.value = false
      clearTimeout(jumpDelay)
    }, 2000)
  }
</script>

<template>
  <div class="login-content" :class="{ jumpPage: jumpPage }">
    <div class="login-container">
      <div class="login-header">
        <div class="login-icon">
          <img src="../assets/img/netease-music.png" alt="" />
        </div>
        <span class="login-title">登录 QQ 音乐账号</span>
      </div>

      <LoginByQRCode class="qrcode-container" ref="loginByQR" @jumpTo="jumpTo" :firstLoadMode="0"></LoginByQRCode>

      <div class="login-other">
        <span class="qrcode-tip">打开手机 QQ 扫码登录</span>
        <div class="login-method">
          <span class="login-tip">登录后可获取完整播放链接</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .login-content {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    .login-container {
      width: 42vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      .login-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        .login-icon {
          width: 7vh;
          height: 7vh;
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }
        .login-title {
          margin-top: 1.5vh;
          font: 2vh SourceHanSansCN-Bold;
          color: black;
        }
      }
      .login-other {
        margin-top: 3vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        .qrcode-tip {
          font: 1.4vh SourceHanSansCN-Bold;
          color: rgb(80, 80, 80);
        }
        .login-method {
          margin-top: 1.2vh;
          .login-tip {
            font: 1.2vh SourceHanSansCN-Bold;
            color: rgb(140, 140, 140);
          }
        }
      }
    }
  }
  .jumpPage {
    opacity: 0;
    transition: 0.4s;
  }
</style>
