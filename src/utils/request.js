import axios from 'axios'
import { getCookie, isLogin, getAuthCookieString } from './authority'
import { noticeOpen } from './dialog'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const request = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
})

let apiReady = false
let pendingRequests = []
let checkApiTimer = null

const setApiReady = () => {
  if (apiReady) return
  apiReady = true
  if (checkApiTimer) {
    clearInterval(checkApiTimer)
    checkApiTimer = null
  }
  const requests = pendingRequests.slice()
  pendingRequests = []
  requests.forEach(({ resolve, config }) => resolve(config))
}

const checkApiReady = () => {
  axios
    .get(API_BASE_URL + '/getTopLists', { timeout: 2000 })
    .then(setApiReady)
    .catch((error) => {
      if (error.response) setApiReady()
      else apiReady = false
    })
}

checkApiTimer = setInterval(checkApiReady, 1000)
checkApiReady()

const waitForApiReady = (config) =>
  new Promise((resolve) => {
    if (apiReady) resolve(config)
    else pendingRequests.push({ resolve, config })
  })

const MAX_RETRY = 2

const createRequest = (config, retryCount = 0) =>
  waitForApiReady(config).then((readyConfig) =>
    request(readyConfig).catch((error) => {
      if (
        retryCount < MAX_RETRY &&
        (error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('Network Error') ||
          !error.response)
      ) {
        noticeOpen('网络连接异常，正在重试...', 1)
        return new Promise((resolve) => setTimeout(resolve, 800 * (retryCount + 1))).then(() =>
          createRequest(config, retryCount + 1)
        )
      }
      throw error
    })
  )

request.interceptors.request.use(
  (config) => {
    if (!config.params) config.params = {}

    if (isLogin()) {
      const cookie = getAuthCookieString()
      if (cookie) {
        config.headers = config.headers || {}
        config.headers['X-Custom-Cookie'] = cookie
        if (config.allowQueryCookie) {
          config.params.cookie = cookie
        } else if (Object.prototype.hasOwnProperty.call(config.params, 'cookie')) {
          delete config.params.cookie
        }
      }
    }
    return config
  },
  (error) => {
    noticeOpen('发起请求错误', 2)
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const url = String(error.config?.url || '')
    const silent =
      error.config?.silentError === true ||
      /checkQQLoginQr|getQQLoginQr|\/user\//.test(url)
    if (!silent) {
      if (error.response) {
        if (error.response.status === 404) noticeOpen('请求的资源不存在', 2)
        else if (error.response.status === 405) noticeOpen('请求方法不被允许', 2)
        else if (error.response.status >= 500) noticeOpen('服务器内部错误', 2)
        else noticeOpen(`请求错误: ${error.response.status}`, 2)
      } else if (error.code === 'ECONNREFUSED') noticeOpen('无法连接到音乐服务', 2)
      else if (error.code === 'ETIMEDOUT') noticeOpen('请求超时', 2)
      else if (error.message?.includes('Network Error')) noticeOpen('网络连接失败', 2)
      else noticeOpen('请求错误', 2)
    }
    return Promise.reject(error)
  }
)

const enhancedRequest = function (config) {
  return createRequest(config)
}

enhancedRequest.get = (url, config = {}) =>
  createRequest({
    method: 'get',
    url,
    ...config,
  })

enhancedRequest.post = (url, data = {}, config = {}) =>
  createRequest({
    method: 'post',
    url,
    data,
    ...config,
  })

enhancedRequest.request = (config) => createRequest(config)

export default enhancedRequest
