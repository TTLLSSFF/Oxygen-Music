import pinia from '../store/pinia'
import { setCookies } from '../utils/authority'
import { getUserProfile } from '../api/user'
import { getUserLikelist } from './initApp'
import { useUserStore } from '../store/userStore'
import { noticeOpen } from './dialog'

const userStore = useUserStore(pinia)
const { updateUser } = userStore

//处理登录后的用户数据
export function loginHandle(data, type) {
  setCookies(data)

  const session = data?.session || data || {}
  const uin = String(session.uin || session.loginUin || '').replace(/^o/, '')
  if (uin) {
    // 先写入基础资料，避免后续接口失败时界面空白
    updateUser({
      userId: uin,
      nickname: session.nick || session.nickname || uin,
      avatarUrl: `https://thirdqq.qlogo.cn/g?b=qq&nk=${uin}&s=100`,
    })
  }

  getUserProfile()
    .then((result) => {
      if (result?.profile) {
        updateUser(result.profile)
      }
      getUserLikelist()
      noticeOpen('登录成功', 2)
    })
    .catch(() => {
      getUserLikelist()
      noticeOpen('登录成功', 2)
    })
}
