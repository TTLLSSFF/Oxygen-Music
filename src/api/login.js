import request from '../utils/request'
import { clearLoginCookies, setCookies } from '../utils/authority'
import { unwrap } from '../utils/qqNormalize'

/**
 * 获取 QQ 音乐扫码登录二维码
 * 兼容旧 UI：返回 data.unikey，同时附带 img/ptqrtoken/qrsig
 */
export async function getQRcode() {
  const res = await request({
    url: '/getQQLoginQr',
    method: 'get',
  })
  // 接口直接返回 { img, ptqrtoken, qrsig }，也可能包在 response/data 里
  const data = unwrap(res) || {}
  const payload = data?.data || data || {}
  const ptqrtoken = String(payload.ptqrtoken ?? payload.ptQrToken ?? '')
  const qrsig = String(payload.qrsig ?? '')
  const img = payload.img || payload.image || payload.qrcode || ''

  if (!ptqrtoken || !qrsig) {
    throw new Error('获取二维码失败：缺少 ptqrtoken/qrsig')
  }

  return {
    code: 200,
    data: {
      unikey: `${ptqrtoken}::${qrsig}`,
      ptqrtoken,
      qrsig,
      img,
    },
  }
}

/**
 * 轮询扫码状态
 * QQ API 要求：POST /checkQQLoginQr，body: { qrsig, ptqrtoken }
 * 映射为旧网易云风格 code：
 * 800 过期 / 801 等待 / 802 待确认 / 803 成功
 */
export async function checkQRcodeStatus(key, extra = {}) {
  let ptqrtoken = extra.ptqrtoken
  let qrsig = extra.qrsig

  if (!ptqrtoken || !qrsig) {
    const parts = String(key || '').split('::')
    ptqrtoken = parts[0]
    qrsig = parts[1]
  }

  if (!qrsig) {
    return { code: 800, message: '二维码参数缺失' }
  }

  const res = await request({
    url: '/checkQQLoginQr',
    method: 'post',
    data: {
      qrsig: String(qrsig),
      ptqrtoken: String(ptqrtoken || ''),
    },
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = unwrap(res) || {}
  const payload = data?.data || data || {}
  const msg = String(payload.message || payload.msg || data?.message || data?.msg || data?.error || '')

  // 成功：isOk + session
  const session = payload.session || data?.session
  if (payload.isOk || session?.cookie || session?.cookieObject) {
    const finalSession = session || {
      cookie: payload.cookie,
      cookieObject: payload.cookieObject,
      uin: payload.uin || payload.loginUin,
      nick: payload.nick || payload.nickname,
    }
    setCookies({ session: finalSession, cookie: finalSession.cookie })
    return {
      code: 803,
      cookie: finalSession.cookie,
      session: finalSession,
      message: msg || '授权登录成功',
    }
  }

  // API 明确要求刷新二维码
  if (payload.refresh === true || data?.refresh === true) {
    return { code: 800, message: msg || '二维码过期' }
  }

  // 失败/错误字段
  if (data?.error || payload?.error) {
    const err = String(data.error || payload.error)
    if (/过期|失效|超时|timeout|expired|refresh/i.test(err + msg)) {
      return { code: 800, message: err || msg || '二维码过期' }
    }
    if (/确认|授权中|scanned/i.test(err + msg)) {
      return { code: 802, message: err || msg || '请确认登录' }
    }
    // 未扫码 / 其它临时状态：继续等待，避免轮询中断
    return { code: 801, message: err || msg || '等待扫码' }
  }

  const rawCode = payload.code ?? data?.code ?? payload.status ?? data?.status
  // QQ 常见：66 等待，67 待确认，65 过期
  if (rawCode === 65 || rawCode === 800 || rawCode === -1) {
    return { code: 800, message: msg || '二维码过期' }
  }
  if (rawCode === 67 || rawCode === 802) {
    return { code: 802, message: msg || '请确认登录' }
  }
  if (rawCode === 66 || rawCode === 801) {
    return { code: 801, message: msg || '等待扫码' }
  }

  if (/过期|失效|超时|expired|timeout/i.test(msg)) {
    return { code: 800, message: msg }
  }
  if (/确认|授权/i.test(msg)) {
    return { code: 802, message: msg }
  }

  return {
    code: 801,
    message: msg || '等待扫码',
    ptqrtoken,
    qrsig,
  }
}

/** 账号密码登录（QQ 源不支持邮箱/手机密码） */
export async function loginByEmail() {
  return Promise.reject(new Error('QQ 音乐仅支持扫码登录'))
}

export async function loginByPhone() {
  return Promise.reject(new Error('QQ 音乐仅支持扫码登录'))
}

export async function sendCaptcha() {
  return Promise.reject(new Error('QQ 音乐仅支持扫码登录'))
}

export async function verifyCaptcha() {
  return Promise.reject(new Error('QQ 音乐仅支持扫码登录'))
}

export async function logout() {
  clearLoginCookies()
  return { code: 200 }
}
