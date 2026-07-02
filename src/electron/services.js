const server = require('@neteasecloudmusicapienhanced/api/server')
const generateConfig = require('@neteasecloudmusicapienhanced/api/generateConfig')

//启动网易云音乐 API Enhanced
module.exports = async function startNeteaseMusicApi() {
  await generateConfig()
  await server.serveNcmApi({
    checkVersion: true,
    port: 36530,
  });
}