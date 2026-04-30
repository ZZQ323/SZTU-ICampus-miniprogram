/**
 * 用户状态管理（Cookie-in-Header 版）
 *
 * Cookies 通过 http.ts 拦截器自动管理：
 * - 请求：从 cookie-manager 读取 → 附加到 X-School-Cookies header
 * - 响应：从 X-Set-Cookies header 读取 → 存入 cookie-manager
 *
 * 不再手动传递 cookiesJson 参数。
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { sessionApi, authApi } from '@/api/auth-apis'
import { getUserInfo, setUserInfo, removeUserInfo } from '@/utils/storage'
import {
  setUserId,
  mergeSchoolCookies,
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

  /** 历史登录过的学号 */
  const lastUsedUserId = ref<string>('')
  const historyUserIds = ref<string[]>([])

  // ==================== 计算属性 ====================

  /** 是否有认证信息（cookies 存在） */
  const hasAuthInfo = computed(() => hasAuth())

  /** 是否已登录学校 */
  const isSchoolLoggedIn = computed(() => !!userInfo.value?.userId)

  // ==================== sessionInvalid 计数器 ====================
  //
  // 长闲置后，学校服务端 TWFID/SESSION 失效但本地 cookies 仍在；按铁规不能
  // 自动清，一直 retry 也救不回来。计数到阈值 → 弹 modal 引导用户走"重置会话"。
  // 持久化到 storage，跨进程/冷启动也累计。

  const SESSION_INVALID_COUNT_KEY = 'icampus_session_invalid_count'
  const SESSION_INVALID_THRESHOLD = 2

  function getSessionInvalidCount(): number {
    return Number(uni.getStorageSync(SESSION_INVALID_COUNT_KEY)) || 0
  }
  function resetSessionInvalidCount(): void {
    uni.removeStorageSync(SESSION_INVALID_COUNT_KEY)
  }
  function handleSessionInvalid(): void {
    const next = getSessionInvalidCount() + 1
    console.warn(`[UserStore] 会话无效，需要重新初始化 (count=${next})`)
    if (next >= SESSION_INVALID_THRESHOLD) {
      // 弹一次后清零，避免连发；用户走完重置流程也会再清一次。
      resetSessionInvalidCount()
      uni.showModal({
        title: '会话异常',
        content: '会话已多次失效。请到首页 → 高级操作 → 重置会话，清空状态后重新登录。',
        showCancel: false,
        confirmText: '我知道了',
      })
    } else {
      uni.setStorageSync(SESSION_INVALID_COUNT_KEY, next)
    }
  }

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
      // 登录成功 → 重置 sessionInvalid 计数（按铁规也不动 cookies）
      resetSessionInvalidCount()
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
      handleSessionInvalid()
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

    // cookies 通过 response header → http.ts 拦截器 → cookie-manager 自动存储
    // 兜底：如果 header 没被读到（uni-app 限制），从 body 手动存
    if (result.cookiesJson && !hasAuth()) {
      console.log('[UserStore] 从 body 兜底存储 cookies')
      mergeSchoolCookies(result.cookiesJson)
    }

    if (result.logined && result.userId) {
      userInfo.value = {
        userId: result.userId,
        realName: result.realName || '',
        gender: result.gender,
        schoolName: result.schoolName,
        avatarURL: result.avatarURL,
      }
      // 已登录的情况下，保存 userId（cookies 已通过 header 自动存储）
      if (result.userId) setUserId(result.userId)
    }

    return result
  }

  /**
   * 完全重置会话
   */
  async function resetSession(): Promise<boolean> {
    console.log('[UserStore] 重置会话')
    userInfo.value = null
    resetSessionInvalidCount()

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

    // cookies 已通过 response header 自动更新

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
   * cookies 通过 header 自动附加和接收
   */
  async function requestSms(userId: string): Promise<void> {
    await authApi.requestSms(userId)
  }

  /**
   * 登录学校系统
   *
   * cookies 通过 header 自动附加（前端 → 后端）和接收（后端 → 前端）
   */
  async function loginSchool(params: LoginRequestParams): Promise<boolean> {
    const result = await authApi.login(params)

    if (result.logined) {
      resetSessionInvalidCount()
      // cookies 通过 response header 自动存储 + body 兜底
      if (result.cookiesJson) {
        mergeSchoolCookies(result.cookiesJson)
      }
      if (result.userId) setUserId(result.userId)

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
   * <p>
   * ⚠️ 不清本地 cookies！HAR 实证：浏览器 logout 后 cookies 整体保留，学校只
   * Set-Cookie 轮换 SESSION + 加 AD_SESSION_FLAG。TWFID / _idp_session 等都
   * 保留下来，下次登录浏览器把这些一起发，学校 IDP 看 SESSION 已轮换会强制
   * 走登录表单——再登录顺畅。
   * <p>
   * 关键时序：
   *   1. **先**断 WS 连接 —— 防止 backend in-flight 爬虫推过来的 COOKIE_UPDATE
   *      落进还连着的 WS，把本地 cookies 复活
   *   2. 调 logout API（后端会清 Redis + 发 UserLogoutEvent + 踢 WS 兜底）
   *   3. reset UI 层状态（userInfo / loginTypes），cookies 留着
   * 完全清空请走 resetSession。
   */
  async function logoutSchool(): Promise<void> {
    // 1. 先断 WS（关键：防止登出过程中 backend 推 COOKIE_UPDATE 复活本地 cookies）
    //    动态 import 避免和 ws.ts 互相 import 循环。
    try {
      const { useWsStore } = await import('@/store/modules/ws')
      useWsStore().disconnect()
    } catch (e) {
      console.warn('[UserStore] 断 WS 失败（不致命）', e)
    }

    // 2. 调后端 logout（后端会清 Redis cookies + 发 UserLogoutEvent → 踢 WS 兜底）
    try {
      await authApi.logout()
    } catch (e) {
      console.warn('[UserStore] 登出请求失败', e)
    }

    // 3. 只 reset UI 状态，cookies 留给学校自己决定（logout 响应里它会更新 SESSION）
    userInfo.value = null
    loginTypes.value = []
  }

  /**
   * 清除学校会话状态（包括本地 cookies）
   * <p>
   * 真正"删一切"的入口，由 resetSession / 紧急逃生 / 切换账号触发，不要在 logout
   * 里调用。
   */
  function clearSchoolSession(): void {
    userInfo.value = null
    loginTypes.value = []
    clearAuth()
  }

  /**
   * 只 reset UI 层状态（userInfo / loginTypes），**保留本地 cookies**。
   * <p>
   * 用途：status / refreshSession 失败时调用 —— 浏览器原生行为是"我不知道
   * 你是否登录了"而不是"忘掉所有 cookie"。把 jar 留着，下次 login 流程能用
   * 旧 TWFID 走完 SSO，对齐学校 IDP 期望。
   * <p>
   * **绝不 clearAuth**。
   */
  function resetUiState(): void {
    userInfo.value = null
    loginTypes.value = []
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
    resetUiState,
    clearAll,
  }
})
