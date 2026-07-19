import Cookies from 'js-cookie'

const AUTH_COOKIE_KEYS = ['uin', 'qqmusic_key', 'qm_keyst', 'p_skey', 'skey', 'login_type', 'tmeLoginType']
const AUTH_COOKIE_STORAGE_PREFIX = 'cookie:'
const AUTH_SESSION_KEY = 'qq_music_session'

function getLocalStore() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch (_) {}
  return null
}

function getCookieStorageKey(key) {
  return AUTH_COOKIE_STORAGE_PREFIX + key
}

function normalizeCookieText(cookieText) {
  return String(cookieText || '')
    .replace(/[\r\n]+/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('; ')
}

export function getCookie(key) {
  try {
    const local = getLocalStore()?.getItem(getCookieStorageKey(key))
    if (local) return local
  } catch (_) {}
  return Cookies.get(key)
}

export function setCookie(key, value) {
  if (!value) return
  try {
    document.cookie = `${key}=${value}; path=/`
  } catch (_) {}
  try {
    getLocalStore()?.setItem(getCookieStorageKey(key), String(value))
  } catch (_) {}
}

function parseCookieString(cookieString) {
  const map = {}
  String(cookieString || '')
    .split(';')
    .forEach((part) => {
      const text = String(part || '').trim()
      if (!text) return
      const idx = text.indexOf('=')
      if (idx <= 0) return
      const name = text.slice(0, idx).trim()
      const value = text.slice(idx + 1).trim()
      if (name && value) map[name] = value
    })
  return map
}

export function setCookies(data) {
  const session = data?.session || data || {}
  let cookieText = normalizeCookieText(session.cookie || data?.cookie || '')
  const cookieMap = {
    ...parseCookieString(cookieText),
    ...(session.cookieObject || {}),
  }

  Object.entries(cookieMap).forEach(([key, value]) => setCookie(key, value))

  const uin = String(session.uin || session.loginUin || cookieMap.uin || cookieMap.superuin || '').replace(
    /^o/,
    ''
  )
  if (uin) {
    setCookie('uin', uin)
    if (!cookieMap.uin) cookieMap.uin = uin
    if (!cookieMap.login_uin && !cookieMap.loginUin) cookieMap.login_uin = uin
  }

  if (!cookieText && Object.keys(cookieMap).length) {
    cookieText = Object.entries(cookieMap)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  } else if (cookieText) {
    cookieText = normalizeCookieText(cookieText)
  }

  try {
    getLocalStore()?.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        uin,
        loginUin: String(session.loginUin || uin || '').replace(/^o/, ''),
        nick: session.nick || session.nickname || '',
        cookie: cookieText,
        cookieObject: cookieMap,
      })
    )
  } catch (_) {}
}

export function getSession() {
  try {
    const text = getLocalStore()?.getItem(AUTH_SESSION_KEY)
    return text ? JSON.parse(text) : null
  } catch (_) {
    return null
  }
}

export function getAuthCookieString() {
  const session = getSession()
  if (session?.cookie) return normalizeCookieText(session.cookie)

  const parts = []
  const pushPart = (key, value) => {
    if (!value) return
    if (parts.find((p) => p.startsWith(key + '='))) return
    parts.push(`${key}=${value}`)
  }

  AUTH_COOKIE_KEYS.forEach((key) => pushPart(key, getCookie(key)))

  try {
    if (session?.cookieObject) {
      Object.entries(session.cookieObject).forEach(([k, v]) => pushPart(k, v))
    }
  } catch (_) {}

  return parts.join('; ')
}

export function isLogin() {
  const session = getSession()
  if (session?.uin || session?.cookie) return true
  return !!(getCookie('uin') || getCookie('qm_keyst') || getCookie('qqmusic_key'))
}

export function clearLoginCookies() {
  AUTH_COOKIE_KEYS.forEach((key) => {
    try {
      getLocalStore()?.removeItem(getCookieStorageKey(key))
    } catch (_) {}
    try {
      document.cookie = `${key}=; Max-Age=0; path=/`
    } catch (_) {}
  })
  try {
    getLocalStore()?.removeItem(AUTH_SESSION_KEY)
  } catch (_) {}
}
