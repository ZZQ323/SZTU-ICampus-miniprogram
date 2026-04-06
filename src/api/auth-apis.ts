/**
 * 认证相关 API（Cookie 直通版）
 *
 * 文件：src/api/auth-apis.ts
 *
 * 变更：
 * - 删除 wxAuthApi（不再需要 JWT token 管理）
 * - authApi.requestSms 需要带 cookiesJson
 * - authApi.login 需要带 wxCode + cookiesJson
 */

import { request } from '@/utils/http'
import type {
  LoginStatusVo,
  LoginResultsVo,
  LoginRequestParams,
} from '@/types/auth'

// ==================== 会话管理（/session） ====================

export const sessionApi = {
  /**
   * 重置会话（清除后端 Redis 缓存）
   */
  resetSession: () =>
    request.post<{ success: boolean; message: string }>('/session/v1/reset'),
}

// ==================== 认证管理（/auth） ====================

export const authApi = {
  // ---------- 状态查询 ----------

  /**
   * 获取登录状态（轻量级，优先读缓存）
   */
  getStatus: () =>
    request.get<LoginStatusVo>('/auth/v1/status'),

  /**
   * 获取历史登录过的学号列表
   */
  getHistory: () =>
    request.get<string[]>('/auth/v1/history'),

  // ---------- 会话管理（公开接口） ----------

  /**
   * 初始化会话（公开接口，获取预登录 cookies + loginTypes）
   * @returns LoginResultsVo 包含 cookiesJson 和 loginTypes
   */
  initSession: () =>
    request.post<LoginResultsVo>('/auth/v1/session/init'),

  /**
   * 刷新会话（仅刷新 SESSION_ID，需认证）
   * @returns LoginResultsVo 包含更新后的 cookiesJson
   */
  refreshSession: () =>
    request.post<LoginResultsVo>('/auth/v1/session/refresh'),

  // ---------- 登录/登出 ----------

  /**
   * 请求发送短信验证码（公开接口）
   * @param userId 学号
   * @param cookiesJson 预登录 cookies
   */
  requestSms: (userId: string, cookiesJson?: string) =>
    request.post<void>('/auth/v1/request/sms', { userId, cookiesJson }),

  /**
   * 登录学校系统（公开接口）
   * @param params 包含 wxCode + cookiesJson + 登录凭证
   * @returns LoginResultsVo 包含登录后 cookiesJson + openId
   */
  login: (params: LoginRequestParams) =>
    request.post<LoginResultsVo>('/auth/v1/login', params),

  /**
   * 登出学校系统
   */
  logout: () =>
    request.post<LoginResultsVo>('/auth/v1/logout'),
}

// ==================== 教务管理（/acdm） ====================

export const academicApi = {
  /**
   * 刷新教务 Cookie
   */
  refreshCookies: () =>
    request.post<void>('/acdm/v1/refresh/cookies'),

  /**
   * 获取课表
   */
  getSchedule: (params?: { week?: number; semester?: string }) =>
    request.post<any>('/acdm/v1/schedule', { params }),
}
