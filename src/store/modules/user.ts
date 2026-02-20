/**
 * 用户状态管理（修复版 - 添加用户信息持久化）
 * 
 * 文件：src/store/modules/user.ts
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { wxAuthApi, authApi } from '@/api/auth-apis';
import { getToken, setToken, removeToken, getUserInfo, setUserInfo, removeUserInfo } from '@/utils/storage';
import type { LoginType, UserInfo, LoginStatusVo,LoginRequestCommand } from '@/types/auth';

export const useUserStore = defineStore('user', () => {
  // ==================== 状态 ====================

  const token = ref(getToken())
  // 【修复】从 Storage 恢复用户信息
  const userInfo = ref<UserInfo | null>(getUserInfo())
  const loginTypes = ref<LoginType[]>([])
  const historyUserIds = ref<string[]>([])
  const cookieExpiringSoon = ref(false)

  // ==================== 计算属性 ====================

  const hasToken = computed(() => !!token.value)
  const isSchoolLoggedIn = computed(() => !!userInfo.value?.userId)

  // ==================== 监听器：自动持久化 ====================

  // 【修复】监听 userInfo 变化，自动同步到 Storage
  watch(userInfo, (newVal) => {
    if (newVal) {
      setUserInfo(newVal)
    } else {
      removeUserInfo()
    }
  }, { deep: true })

  // ==================== Token 管理 ====================

  /**
   * 初始化 token（App.vue onLaunch 调用）
   */
  async function initToken() {
    const { code } = await uni.login()
    const res = await wxAuthApi.getToken(code)
    token.value = res.data.token
    setToken(res.data.token)
  }

  /**
   * 刷新 token（401 时调用）
   */
  async function refreshTokenIfNeeded(): Promise<boolean> {
    try {
      const { code } = await uni.login()
      const res = await wxAuthApi.refreshToken(code)
      token.value = res.data.token
      setToken(res.data.token)
      return true
    } catch (e) {
      return false
    }
  }

  // ==================== 会话管理 ====================

  /**
   * 检查学校登录状态（轻量级，不清除 Cookie）
   */
  async function checkSchoolSession(): Promise<LoginStatusVo> {
    const res = await authApi.getStatus()
    const status = res.data

    loginTypes.value = status.loginTypes || []
    cookieExpiringSoon.value = status.cookieExpiringSoon || false
    if(res.status==401){
      if( await refreshTokenIfNeeded() === false){
        await initSession();
      }
    }
    // 【修复】如果后端返回已登录但本地没有 userInfo，标记需要刷新
    // 这种情况说明用户信息丢失了，但实际上是登录状态
    if (status.logined && !userInfo.value) {
      console.warn('检测到已登录但本地无用户信息，可能需要重新获取')
    }
    return status
  }

  /**
   * 初始化会话（强制重建 Cookie）
   */
  async function initSession() {
    const res = await authApi.initSession()
    const result = res.data

    loginTypes.value = result.loginTypes || []
    // 如果已登录，更新用户信息（会自动持久化）
    if (result.logined && result.userId) {
      userInfo.value = {
        userId: result.userId,
        realName: result.realName || '',
        gender: result.gender,
        schoolName: result.schoolName,
        avatarURL: result.avatarURL,
      }
    }
    return result
  }

  /**
   * 刷新会话（仅刷新 SESSION_ID）
   */
  async function refreshSession() {
    try {
      const res = await authApi.refreshSession()
      cookieExpiringSoon.value = false
      return res.data
    } catch (e: any) {
      if (e?.response?.status === 401) {
        clearSchoolSession()
      }
      throw e
    }
  }

  /**
   * 获取历史登录学号
   */
  async function fetchHistoryUserIds() {
    const res = await authApi.getHistory()
    historyUserIds.value = res.data || []
    return historyUserIds.value
  }

  // ==================== 登录/登出 ====================

  /**
   * 请求短信验证码
   */
  async function requestSms(userId: string) {
    await authApi.requestSms(userId)
  }

  /**
   * 登录学校系统
   */
  async function loginSchool(params: LoginRequestCommand) {
    const res = await authApi.login(params)
    const result = res.data

    if (result.logined) {
      console.log("result："+Object.getOwnPropertyNames(result));
      // 【修复】更新用户信息（会自动持久化到 Storage）
      userInfo.value = {
        userId: result.userId || params.userId,
        realName: result.realName || '',
        gender: result.gender,
        schoolName: result.schoolName,
        avatarURL: result.avatarURL,
      }

      // 更新历史学号
      if (!historyUserIds.value.includes(params.userId)) {
        historyUserIds.value.push(params.userId)
      }
    }

    return result.logined
  }

  /**
   * 登出学校系统
   */
  async function logoutSchool() {
    await authApi.logout({})
    clearSchoolSession()
  }

  /**
   * 清除学校会话状态
   */
  function clearSchoolSession() {
    // 【修复】清除内存中的用户信息（watch 会自动清除 Storage）
    userInfo.value = null
    loginTypes.value = []
    cookieExpiringSoon.value = false
  }

  /**
   * 完全清除所有状态
   */
  function clearAll() {
    token.value = ''
    removeToken()
    clearSchoolSession()
    historyUserIds.value = []
  }

  // ==================== 导出 ====================

  return {
    // 状态
    token,
    userInfo,
    loginTypes,
    historyUserIds,
    cookieExpiringSoon,

    // 计算属性
    hasToken,
    isSchoolLoggedIn,

    // Token 管理
    initToken,
    refreshTokenIfNeeded,

    // 会话管理
    checkSchoolSession,
    initSession,
    refreshSession,
    fetchHistoryUserIds,

    // 登录/登出
    requestSms,
    loginSchool,
    logoutSchool,
    clearSchoolSession,
    clearAll,
  }
})