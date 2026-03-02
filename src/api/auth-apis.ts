/**
 * 认证相关 API（修复版 - 类型正确）
 * 
 * 文件：src/api/auth-apis.ts
 * 
 * ⭐ 重要：由于 HTTP 拦截器已经解包了 { code, message, data }
 *    这里的泛型直接写业务数据类型即可
 * 
 * 例如：request.get<TokenVo>() 返回 Promise<TokenVo>
 */

import { request } from '@/utils/http'
import type {
  LoginStatusVo,
  LoginResultsVo,
  LoginRequestCommand,
  TokenVo
} from '@/types/auth'

// ==================== Token 管理（/wx-auth） ====================

export const wxAuthApi = {
  /**
   * 检验 Token 是否有效
   * @returns boolean
   */
  active: () =>
    request.get<boolean>('/wx-auth/v1/active'),

  /**
   * 用 wx.login 的 code 换取 JWT
   * @returns TokenVo { token: string }
   */
  getToken: (wxCode: string) =>
    request.post<TokenVo>('/wx-auth/v1/get-token', { wxCode }),

  /**
   * 刷新过期 Token
   * @returns TokenVo { token: string }
   */
  refreshToken: (wxCode: string) =>
    request.post<TokenVo>('/wx-auth/v1/refresh-token', { wxCode }),
}

// ==================== 认证管理（/auth） ====================

export const authApi = {
  // ---------- 状态查询 ----------

  /**
   * 获取登录状态（轻量级，优先读缓存）
   * @returns LoginStatusVo
   */
  getStatus: () =>
    request.get<LoginStatusVo>('/auth/v1/status'),

  /**
   * 获取历史登录过的学号列表
   * @returns string[]
   */
  getHistory: () =>
    request.get<string[]>('/auth/v1/history'),

  // ---------- 会话管理 ----------

  /**
   * 初始化会话（强制重建 Cookie）
   * @returns LoginResultsVo
   */
  initSession: () =>
    request.post<LoginResultsVo>('/auth/v1/session/init'),

  /**
   * 刷新会话（仅刷新 SESSION_ID）
   * @returns LoginResultsVo
   */
  refreshSession: () =>
    request.post<LoginResultsVo>('/auth/v1/session/refresh'),

  // ---------- 登录/登出 ----------

  /**
   * 请求发送短信验证码
   * @returns void
   */
  requestSms: (userId: string) =>
    request.post<void>('/auth/v1/request/sms', { userId }),

  /**
   * 登录学校系统
   * @returns LoginResultsVo
   */
  login: (params: LoginRequestCommand) =>
    request.post<LoginResultsVo>('/auth/v1/login', params),

  /**
   * 登出学校系统
   * @returns LoginResultsVo
   */
  logout: (params: Partial<LoginRequestCommand>) =>
    request.post<LoginResultsVo>('/auth/v1/logout', params),
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
    request.get<any>('/acdm/v1/schedule', { params }),
}