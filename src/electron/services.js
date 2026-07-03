const fs = require('fs')
const path = require('path')
const os = require('os')
const generateConfig = require('@neteasecloudmusicapienhanced/api/generateConfig')

const tmpPath = os.tmpdir()

/**
 * 确保 /tmp/xeapi_public_key 已存在。
 * generateConfig 内部会先调用 register_anonimous，而该接口使用 xeapi 加密，
 * 必须预先存在公钥文件，否则会抛出 "xeapi public key is missing"。
 */
async function ensureXeapiPublicKey() {
  const keyPath = path.resolve(tmpPath, 'xeapi_public_key')
  try {
    const content = fs.readFileSync(keyPath, 'utf-8')
    if (content && JSON.parse(content).sk) {
      return
    }
  } catch (_) {
    // 文件不存在或内容无效，继续生成
  }

  const { generateDeviceId } = require('@neteasecloudmusicapienhanced/api/util/index')
  const registerXeapiKey = require('@neteasecloudmusicapienhanced/api/module/register_xeapikey')

  const deviceId = generateDeviceId()
  global.deviceId = deviceId

  const result = await registerXeapiKey({ deviceId }, null)
  const publicKey = result.body
  if (!publicKey || !publicKey.sk) {
    throw new Error('failed to fetch xeapi public key')
  }

  fs.writeFileSync(keyPath, JSON.stringify(publicKey), 'utf-8')
}

//启动网易云音乐 API Enhanced
module.exports = async function startNeteaseMusicApi() {
  // 1. 预生成 xeapi 公钥，供 generateConfig 中的 register_anonimous 使用
  await ensureXeapiPublicKey()
  // 2. 生成 anonymous_token 等配置文件
  await generateConfig()
  // 3. 加载 server 模块（会同步读取 /tmp/anonymous_token）
  const server = require('@neteasecloudmusicapienhanced/api/server')
  await server.serveNcmApi({
    checkVersion: true,
    port: 36530,
  });
}