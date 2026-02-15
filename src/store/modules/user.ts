/**
 * 用户状态管理
 *
 * 管理：登录状态、用户信息、token
 *
 * 使用方式：
 *   import { useUserStore } from '@/store'
 *   const userStore = useUserStore()
 *   userStore.login(...)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getToken, setToken, removeToken, clearStorage } from '@/utils/storage'
import { authApi } from '@/api/auth'
import type { UserInfo, LoginMethod } from '@/api/types/auth'

export const useUserStore = defineStore('user', () => {
  // ====== 状态 ======
  const token = ref(getToken())
  const userInfo = ref<UserInfo | null>(null)
  const loginMethod = ref<LoginMethod>('password')

  // ====== 计算属性 ======
  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => userInfo.value?.name || '未登录')

  // ====== 方法 ======

  /**
   * 检查登录状态
   * 你的流程：点头像 → 清缓存 → 请求胶水层检查 → 返回是否需要登录 + 登录方式
   */
  async function checkLogin() {
    clearStorage()  // 你的需求：先清空缓存

    const res = await authApi.check()

    // 胶水层可能返回新 token（旧的快过期了，自动换）
    if (res.data.newToken) {
      token.value = res.data.newToken
      setToken(res.data.newToken)
    }

    loginMethod.value = res.data.loginMethod

    return {
      needLogin: res.data.needLogin,
      method: res.data.loginMethod,
    }
  }

  /** 发短信验证码 */
  async function sendSms(phone: string) {
    await authApi.sendSmsCode(phone)
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  }

  /** 登录（统一入口，根据 method 调不同接口） */
  async function login(params: {
    method: LoginMethod
    username?: string
    password?: string
    phone?: string
    smsCode?: string
  }) {
    let res
    if (params.method === 'password') {
      res = await authApi.loginByPassword(params.username!, params.password!)
    } else {
      res = await authApi.loginBySms(params.phone!, params.smsCode!)
    }

    // 存 token 和用户信息
    token.value = res.data.token
    userInfo.value = res.data.userInfo
    setToken(res.data.token)
  }

  /** 退出登录 */
  function logout() {
    token.value = ''
    userInfo.value = null
    removeToken()
    clearStorage()
  }

  return {
    token, userInfo, loginMethod,
    isLoggedIn, userName,
    checkLogin, sendSms, login, logout,
  }
}, {
  // 持久化配置：把 token 和 userInfo 存到小程序 Storage
  persist: {
    key: 'user-store',
    storage: {
      getItem: (key: string) => uni.getStorageSync(key),
      setItem: (key: string, value: string) => uni.setStorageSync(key, value),
    },
    pick: ['token', 'userInfo'],
  },
})
