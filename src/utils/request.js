import axios from "axios";
import { getCookie, isLogin } from '../utils/authority'
import pinia from "../store/pinia";
import { useLibraryStore } from '../store/libraryStore'

const libraryStore = useLibraryStore(pinia)

import { noticeOpen } from "./dialog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:36530'

const request = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 15000,
});

let apiReady = false;
let pendingRequests = [];
let checkApiTimer = null;

const setApiReady = () => {
    if (!apiReady) {
        apiReady = true;
        if (checkApiTimer) {
            clearInterval(checkApiTimer);
            checkApiTimer = null;
        }
        const requests = pendingRequests.slice();
        pendingRequests = [];
        requests.forEach(({ resolve, config }) => {
            resolve(config);
        });
    }
}

const checkApiReady = () => {
    axios.get(API_BASE_URL, { timeout: 2000 })
        .then(setApiReady)
        .catch((error) => {
            // 只要服务端有响应（即使是 404/500）也视为已就绪，
            // 避免因为根路径返回非 2xx 而一直阻塞请求。
            if (error.response) {
                setApiReady();
            } else {
                apiReady = false;
            }
        });
};

checkApiTimer = setInterval(checkApiReady, 1000);
checkApiReady();

const waitForApiReady = (config) => {
    return new Promise((resolve) => {
        if (apiReady) {
            resolve(config);
        } else {
            pendingRequests.push({ resolve, config });
        }
    });
};

const MAX_RETRY = 3;

const createRequest = (config, retryCount = 0) => {
    return waitForApiReady(config).then((readyConfig) => {
        return request(readyConfig).catch((error) => {
            if (retryCount < MAX_RETRY && 
                (error.code === 'ECONNREFUSED' || 
                 error.code === 'ETIMEDOUT' || 
                 error.message.includes('Network Error') ||
                 (!error.response))) {
                noticeOpen("网络连接异常，正在重试...", 1);
                return new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
                    .then(() => createRequest(config, retryCount + 1));
            }
            throw error;
        });
    });
};

// 请求拦截器
request.interceptors.request.use(function (config) {
  if (!config.params) {
    config.params = {};
  }
  if (config.url !== '/login/qr/check' && isLogin()) {
    config.params.cookie = `MUSIC_U=${getCookie('MUSIC_U')};`;
  }
  if (libraryStore.needTimestamp && libraryStore.needTimestamp.indexOf(config.url) !== -1) {
    config.params.timestamp = new Date().getTime()
  }
  return config;
}, function (error) {
  noticeOpen("发起请求错误", 2)
  return Promise.reject(error);
});

// 响应拦截器
request.interceptors.response.use(function (response) {
  return response.data
}, function (error) {
  if (error.response) {
    if (error.response.status === 404) {
      noticeOpen("请求的资源不存在", 2);
    } else if (error.response.status === 500) {
      noticeOpen("服务器内部错误", 2);
    } else {
      noticeOpen(`请求错误: ${error.response.status}`, 2);
    }
  } else if (error.code === 'ECONNREFUSED') {
    noticeOpen("无法连接到音乐服务", 2);
  } else if (error.code === 'ETIMEDOUT') {
    noticeOpen("请求超时", 2);
  } else if (error.message.includes('Network Error')) {
    noticeOpen("网络连接失败", 2);
  } else {
    noticeOpen("请求错误", 2);
  }
  return Promise.reject(error);
});

const enhancedRequest = function(config) {
    return createRequest(config);
};

enhancedRequest.get = (url, config = {}) => {
    return createRequest({
        method: 'get',
        url,
        ...config
    });
};

enhancedRequest.post = (url, data = {}, config = {}) => {
    return createRequest({
        method: 'post',
        url,
        data,
        ...config
    });
};

enhancedRequest.request = (config) => {
    return createRequest(config);
};

export default enhancedRequest;
