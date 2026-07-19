/** 云盘为网易云独占功能，QQ 源下提供空实现以兼容旧引用 */

export async function getCloudDiskData() {
  return { code: 200, data: [], count: 0 }
}

export async function getCloudDiskDrtail() {
  return { code: 200, data: [] }
}

export async function deleteCloudSong() {
  return { code: 200, message: 'QQ 源不支持云盘' }
}

export async function uploadCloudSong() {
  return Promise.reject(new Error('QQ 源不支持云盘上传'))
}
