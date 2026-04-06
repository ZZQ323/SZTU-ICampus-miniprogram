/**
 * 用户状态管理（Cookie 直通版）
 *
 * 文件：src/store/modules/user.ts
 *
 * 变更：
 * - 移除 JWT token 管理（initToken、refreshToken、checkTokenActive）
 * - 使用 cookie-manager 管理 cookies + openId
 * - loginSchool 流程：获取 wxCode → 带 cookies 登录 → 存储返回的 cookies + openId
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { sessionApi, authApi } from '@/api/auth-apis'
import { getUserInfo, setUserInfo, removeUserInfo } from '@/utils/storage'
import {
  getSchoolCookies,
  setSchoolCookies,
  getOpenId,
  setOpenId,
  clearAuth,
  hasAuth,
} from '@/utils/cookie-manager'

import type {
  LoginType,
  UserInfo,
  LoginStatusVo,
  LoginRequestParams,
  LoginResultsVo
} from '@/types/auth'

export const useUserStore = defineStore('user', () => {
  // ==================== 状态 ====================

  /** 用户信息 */
  const userInfo = ref<UserInfo | null>(getUserInfo())

  /** 可用的登录方式 */
  const loginTypes = ref<string[]>([])

  /** 预登录 cookies（initSession 返回，登录时使用） */
  const preAuthCookies = ref('')

  /** 历史登录过的学号 */
  const lastUsedUserId = ref<string>('')
  const historyUserIds = ref<string[]>([])

  // ==================== 计算属性 ====================

  /** 是否有认证信息（openId + cookies） */
  const hasAuthInfo = computed(() => hasAuth())

  /** 是否已登录学校 */
  const isSchoolLoggedIn = computed(() => !!userInfo.value?.userId)

  // ==================== 监听器：自动持久化 ====================

  watch(userInfo, (newVal) => {
    if (newVal) {
      setUserInfo(newVal)
    } else {
      removeUserInfo()
    }
  }, { deep: true })

  // ==================== 会话管理 ====================

  /**
   * 检查学校登录状态（轻量级）
   *
   * 当 logined=false 时，立即清除本地的 userInfo
   */
  async function checkSchoolSession(): Promise<LoginStatusVo> {
    const status = await authApi.getStatus()

    loginTypes.value = status.loginTypes || []

    if (status.logined && status.userId) {
      userInfo.value = {
        userId: status.userId,
        realName: status.realName || '',
        gender: status.gender,
        schoolName: status.schoolName,
        avatarURL: status.avatarURL,
      }
    } else {
      if (userInfo.value !== null) {
        console.log('[UserStore] 未登录，清除用户信息')
        userInfo.value = null
      }
    }

    if (status.sessionInvalid) {
      console.warn('[UserStore] 会话无效，需要重新初始化')
    }

    return status
  }

  /**
   * 初始化会话（公开接口，获取预登录 cookies + loginTypes）
   */
  async function initSession(): Promise<LoginResultsVo> {
    console.log('[UserStore] 初始化会话')
    userInfo.value = null

    const result = await authApi.initSession()

    loginTypes.value = result.loginTypes || []

    // 保存预登录 cookies（登录时需要带上）
    if (result.cookiesJson) {
      preAuthCookies.value = result.cookiesJson
    }

    if (result.logined && result.userId) {
      userInfo.value = {
        userId: result.userId,
        realName: result.realName || '',
        gender: result.gender,
        schoolName: result.schoolName,
        avatarURL: result.avatarURL,
      }
      // 已登录的情况下，保存 cookies 和 openId
      if (result.cookiesJson) setSchoolCookies(result.cookiesJson)
      if (result.openId) setOpenId(result.openId)
    }

    return result
  }

  /**
   * 完全重置会话
   */
  async function resetSession(): Promise<boolean> {
    console.log('[UserStore] 重置会话')
    userInfo.value = null

    try {
      await sessionApi.resetSession()
      console.log('[UserStore] 后端会话已清除')
    } catch (e) {
      console.warn('[UserStore] 清除后端会话失败', e)
    }

    clearAll()

    // 重新初始化（获取 loginTypes）
    try {
      await initSession()
    } catch (e) {
      console.warn('[UserStore] 初始化学校会话失败', e)
    }

    return true
  }

  /**
   * 刷新会话（仅刷新 SESSION_ID）
   */
  async function refreshSession(): Promise<LoginResultsVo> {
    const result = await authApi.refreshSession()

    // 更新 cookies
    if (result.cookiesJson) {
      setSchoolCookies(result.cookiesJson)
    }

    if (result.logined && result.userId) {
      userInfo.value = {
        userId: result.userId,
        realName: result.realName || '',
        gender: result.gender,
        schoolName: result.schoolName,
        avatarURL: result.avatarURL,
      }
    } else {
      userInfo.value = null
    }

    return result
  }

  /**
   * 获取历史登录学号
   */
  async function fetchHistoryUserIds(): Promise<string[]> {
    try {
      const ids = await authApi.getHistory()
      historyUserIds.value = ids || []
      return historyUserIds.value
    } catch (e) {
      console.warn('[UserStore] 获取历史学号失败', e)
      return []
    }
  }

  // ==================== 登录/登出 ====================

  /**
   * 请求短信验证码
   */
  async function requestSms(userId: string): Promise<void> {
    await authApi.requestSms(userId, preAuthCookies.value || undefined)
  }

  /**
   * 登录学校系统
   *
   * 流程：
   * 1. wx.login() 获取 wxCode
   * 2. 带 wxCode + preAuthCookies + 凭证 → 后端登录
   * 3. 存储返回的 cookies + openId
   */
  async function loginSchool(params: LoginRequestParams): Promise<boolean> {
    // 1. 获取 wxCode
    const loginResult = await uni.login()
    if (!loginResult.code) {
      throw new Error('获取微信 code 失败')
    }

    // 2. 登录
    const result = await authApi.login({
      ...params,
      wxCode: loginResult.code,
      cookiesJson: preAuthCookies.value || undefined,
    })

    if (result.logined) {
      // 3. 存储 cookies + openId
      if (result.cookiesJson) setSchoolCookies(result.cookiesJson)
      if (result.openId) setOpenId(result.openId)

      // 更新用户信息
      userInfo.value = {
        userId: result.userId || params.userId,
        realName: result.realName || '',
        gender: result.gender,
        schoolName: result.schoolName,
        avatarURL: result.avatarURL,
      }

      // 更新历史学号
      if (!historyUserIds.value.includes(params.userId)) {
        historyUserIds.value.unshift(params.userId)
        if (historyUserIds.value.length > 5) {
          historyUserIds.value = historyUserIds.value.slice(0, 5)
        }
      }
    }

    return result.logined
  }

  /**
   * 登出学校系统
   */
  async function logoutSchool(): Promise<void> {
    try {
      await authApi.logout()
    } catch (e) {
      console.warn('[UserStore] 登出请求失败', e)
    }
    clearSchoolSession()
  }

  /**
   * 清除学校会话状态（包括本地 cookies）
   */
  function clearSchoolSession(): void {
    userInfo.value = null
    loginTypes.value = []
    clearAuth()
  }

  /**
   * 完全清除所有状态
   */
  function clearAll(): void {
    clearSchoolSession()
  }

  /**
   * 设置上次使用的学号
   */
  function setLastUsedUserId(userId: string) {
    lastUsedUserId.value = userId
    if (!historyUserIds.value.includes(userId)) {
      historyUserIds.value.unshift(userId)
      if (historyUserIds.value.length > 5) {
        historyUserIds.value.pop()
      }
    }
    uni.setStorageSync('lastUsedUserId', userId)
    uni.setStorageSync('historyUserIds', historyUserIds.value)
  }

  function initUserIdHistory() {
    lastUsedUserId.value = uni.getStorageSync('lastUsedUserId') || ''
    historyUserIds.value = uni.getStorageSync('historyUserIds') || []
  }

  function initLastUsedUserId() {
    const stored = uni.getStorageSync('lastUsedUserId')
    if (stored) {
      lastUsedUserId.value = stored
    }
  }

  // ==================== 导出 ====================

  return {
    // 状态
    userInfo,
    loginTypes,
    preAuthCookies,

    historyUserIds,
    lastUsedUserId,
    setLastUsedUserId,

    // 计算属性
    hasAuthInfo,
    isSchoolLoggedIn,

    // 会话管理
    checkSchoolSession,
    initSession,
    resetSession,
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
