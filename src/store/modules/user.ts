/**
 * 用户状态管理（修复版 - 类型正确）
 * 
 * 文件：src/store/modules/user.ts
 * 
 * 职责：
 * - 管理 Token 和用户信息
 * - 提供认证相关的 API 调用方法
 * 
 * 注意：API 返回的直接是业务数据，不需要 .data 访问
 *    例如：const res = await wxAuthApi.getToken(code)
 *          res.token  // 直接访问，res 的类型就是 TokenVo
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { wxAuthApi, authApi } from '@/api/auth-apis'
import {
  getToken,
  setToken,
  removeToken,
  getUserInfo,
  setUserInfo,
  removeUserInfo
} from '@/utils/storage'
import type {
  LoginType,
  UserInfo,
  LoginStatusVo,
  LoginRequestParams,
  LoginResultsVo
} from '@/types/auth'

export const useUserStore = defineStore('user', () => {
  // ==================== 状态 ====================

  /** JWT Token */
  const token = ref(getToken())

  /** 用户信息 */
  const userInfo = ref<UserInfo | null>(getUserInfo())

  /** 可用的登录方式 */
  const loginTypes = ref<string[]>([])

  /** 历史登录过的学号 */
  const lastUsedUserId = ref<string>('')
  const historyUserIds = ref<string[]>([])

  // ==================== 计算属性 ====================

  /** 是否有 Token */
  const hasToken = computed(() => !!token.value)

  /** 是否已登录学校 */
  const isSchoolLoggedIn = computed(() => !!userInfo.value?.userId)

  // ==================== 监听器：自动持久化 ====================

  // 监听 userInfo 变化，自动同步到 Storage
  watch(userInfo, (newVal) => {
    if (newVal) {
      setUserInfo(newVal)
    } else {
      removeUserInfo()
    }
  }, { deep: true })

  // ==================== Token 管理 ====================

  /**
   * 初始化 Token（首次获取）
   * 
   * 流程：wx.login() → 后端换取 JWT
   */
  async function initToken(): Promise<void> {
    const loginResult = await uni.login()
    if (!loginResult.code) {
      throw new Error('获取微信 code 失败')
    }

    // ⭐ API 直接返回 TokenVo，不需要 .data
    const result = await wxAuthApi.getToken(loginResult.code)
    token.value = result.token
    setToken(result.token)
  }

  /**
   * 刷新 Token
   * 
   * @returns 是否刷新成功
   */
  async function refreshTokenIfNeeded(): Promise<boolean> {
    try {
      const loginResult = await uni.login()
      if (!loginResult.code) {
        console.error('[UserStore] 获取 wx code 失败')
        return false
      }

      // ⭐ API 直接返回 TokenVo
      const result = await wxAuthApi.refreshToken(loginResult.code)
      token.value = result.token
      setToken(result.token)
      return true
    } catch (e) {
      console.error('[UserStore] 刷新 Token 失败', e)
      return false
    }
  }


  /**
   * 检查 Token 是否有效
   * 
   * @returns true 表示有效
   */
  async function checkTokenActive(): Promise<boolean> {
    try {
      // ⭐ API 直接返回 boolean
      const isActive = await wxAuthApi.active()
      return isActive === true
    } catch (e) {
      return false
    }
  }

  // ==================== 会话管理 ====================

  /**
   * 检查学校登录状态（轻量级）
   * 
   * 返回的状态会自动更新本地的 userInfo
   */
  async function checkSchoolSession(): Promise<LoginStatusVo> {
    // ⭐ API 直接返回 LoginStatusVo
    const status = await authApi.getStatus()

    // 更新本地状态
    loginTypes.value = status.loginTypes || []

    // 如果已登录，同步用户信息
    if (status.logined && status.userId) {
      userInfo.value = {
        userId: status.userId,
        realName: status.realName || '',
        gender: status.gender,
        schoolName: status.schoolName,
        avatarURL: status.avatarURL,
      }
    }

    return status
  }

  /**
   * 初始化会话（强制重建 Cookie）
   */
  async function initSession(): Promise<LoginResultsVo> {
    // API 直接返回 LoginResultsVo
    const result = await authApi.initSession()

    loginTypes.value = result.loginTypes || []

    // 如果已登录，更新用户信息
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
 * 完全重置会话
 * 
 * 流程：
 * 1. 调用后端清除 Redis（TokenMeta + ProxySession）
 * 2. 清除本地存储
 * 3. 重新获取 Token
 * 4. 重新初始化学校会话
 * 
 * @returns 是否成功
 */
  async function resetSession(): Promise<boolean> {
    try {
      // 1. 调用后端清除 Redis
      await wxAuthApi.resetSession()
      console.log('[UserStore] 后端会话已清除')

    } catch (e) {
      console.warn('[UserStore] 清除后端会话失败（可能 token 已失效）', e)
      // 继续执行，因为可能 token 本身就无效了
    }

    // 2. 清除本地存储
    clearAll()

    // 3. 重新获取 Token
    try {
      await initToken()
      console.log('[UserStore] Token 已重新获取')
    } catch (e) {
      console.error('[UserStore] 重新获取 Token 失败', e)
      return false
    }

    // 4. 重新初始化学校会话（获取 loginTypes）
    try {
      await initSession()
      console.log('[UserStore] 学校会话已重新初始化')
    } catch (e) {
      console.warn('[UserStore] 初始化学校会话失败', e)
      // 不影响整体流程
    }

    return true
  }

  /**
   * 刷新会话（仅刷新 SESSION_ID）
   */
  async function refreshSession(): Promise<LoginResultsVo> {
    // ⭐ API 直接返回 LoginResultsVo
    const result = await authApi.refreshSession()
    return result
  }

  /**
   * 获取历史登录学号
   */
  async function fetchHistoryUserIds(): Promise<string[]> {
    try {
      // ⭐ API 直接返回 string[]
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
    await authApi.requestSms(userId)
  }

  /**
   * 登录学校系统
   * 
   * @returns 是否登录成功
   */
  async function loginSchool(params: LoginRequestParams): Promise<boolean> {
    // ⭐ API 直接返回 LoginResultsVo
    const result = await authApi.login(params)

    if (result.logined) {
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
        // 最多保留 5 个
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
      await authApi.logout({})
    } catch (e) {
      console.warn('[UserStore] 登出请求失败', e)
    }
    clearSchoolSession()
  }

  /**
   * 清除学校会话状态（不清除 Token）
   */
  function clearSchoolSession(): void {
    userInfo.value = null
    loginTypes.value = []
  }

  /**
   * 完全清除所有状态
   */
  function clearAll(): void {
    token.value = ''
    removeToken()
    clearSchoolSession()
    // 保留历史学号
  }

  /**
 * 设置上次使用的学号
 */
  function setLastUsedUserId(userId: string) {
    lastUsedUserId.value = userId
    // 添加到历史
    if (!historyUserIds.value.includes(userId)) {
      historyUserIds.value.unshift(userId)
      if (historyUserIds.value.length > 5) {
        historyUserIds.value.pop()
      }
    }
    uni.setStorageSync('lastUsedUserId', userId)
    uni.setStorageSync('historyUserIds', historyUserIds.value)
  }

  // 初始化时恢复
  function initUserIdHistory() {
    lastUsedUserId.value = uni.getStorageSync('lastUsedUserId') || ''
    historyUserIds.value = uni.getStorageSync('historyUserIds') || []
  }

  /**
   * 初始化时从本地存储恢复
   */
  function initLastUsedUserId() {
    const stored = uni.getStorageSync('lastUsedUserId')
    if (stored) {
      lastUsedUserId.value = stored
    }
  }

  // ==================== 导出 ====================

  return {
    // 状态
    token,
    userInfo,
    loginTypes,

    historyUserIds,
    lastUsedUserId,
    setLastUsedUserId,

    // 计算属性
    hasToken,
    isSchoolLoggedIn,

    // Token 管理
    initToken,
    refreshTokenIfNeeded,
    checkTokenActive,

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