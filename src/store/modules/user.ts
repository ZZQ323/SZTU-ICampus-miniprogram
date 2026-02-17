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
import { authApi, wxAuthApi } from '@/api/api'
import type { UserInfo, LoginType, LoginResultsVo } from '@/api/types/auth'

export const useUserStore = defineStore('user', () => {
  // ====== 状态 ======
  const token = ref(getToken())
  const userInfo = ref<UserInfo | null>(null)
  const loginTypes = ref<LoginType[]>([])

  // ====== 计算属性 ======
  const hasToken = computed(() => !!token.value)
  const isSchoolLoggedIn = computed(() => !!userInfo.value?.userId)
  const userName = computed(() => userInfo.value?.realName || '未登录')

  // ====== 方法 ======

  /**
   * 检查学校登录状态
   * 流程：点头像 → 刷新cookie → 检查session → 返回是否已登录 + 可用登录方式
   */
  async function checkSchoolSession(): Promise<{
    isLogined: boolean
    loginTypes: LoginType[]
  }> {
    // 先刷新 cookie
    await authApi.refreshCookie()
    // 检查 session 状态
    const res = await authApi.getSessionStatus()
    const data: LoginResultsVo = res.data

    // 更新可用登录方式
    loginTypes.value = data.loginTypes || []

    // 如果已登录，更新用户信息
    if (data.isLogined && data.userId) {
      userInfo.value = {
        userId: data.userId,
        realName: data.realName || '',
        gender: data.gender,
        schoolName: data.schoolName,
        avatarURL: data.avatarURL,
      }
    }

    return {
      isLogined: data.isLogined,
      loginTypes: data.loginTypes || [],
    }
  }

  /** 发短信验证码 */
  async function sendSms(userId: string) {
    await authApi.requestSms(userId)
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  }

  /** 登录学校系统 */
  async function loginSchool(params: {
    loginType: LoginType
    userId: string
    password?: string
    smsCode?: string
  }) {
    const res = await authApi.login({
      userId: params.userId,
      password: params.password,
      smsCode: params.smsCode,
      loginType: params.loginType,
    })

    const data: LoginResultsVo = res.data

    // 更新用户信息
    if (data.isLogined && data.userId) {
      userInfo.value = {
        userId: data.userId,
        realName: data.realName || '',
        gender: data.gender,
        schoolName: data.schoolName,
        avatarURL: data.avatarURL,
      }
    }

    return data.isLogined
  }

  /** 初始化 token（App.vue onLaunch 调用） */
  async function initToken() {
    try {
      const { code } = await uni.login()
      const res = await wxAuthApi.getToken(code)
      token.value = res.data.token
      setToken(res.data.token)
    } catch (e) {
      console.error('initToken failed:', e)
    }
  }

  /** 退出登录 */
  async function logout() {
    if (userInfo.value?.userId) {
      await authApi.logout(userInfo.value.userId)
    }
    userInfo.value = null
    loginTypes.value = []
  }

  /** 完全退出（清除 token） */
  function logoutAll() {
    logout()
    token.value = ''
    removeToken()
    clearStorage()
  }

  return {
    token, userInfo, loginTypes,
    hasToken, isSchoolLoggedIn, userName,
    initToken, checkSchoolSession, sendSms, loginSchool, logout, logoutAll,
  }
}, {
  persist: {
    key: 'user-store',
    storage: {
      getItem: (key: string) => uni.getStorageSync(key),
      setItem: (key: string, value: string) => uni.setStorageSync(key, value),
    },
    pick: ['token', 'userInfo'],
  },
})