/**
 * 认证相关 API
 * 
 * 文件：src/api/auth-apis.ts
 */

import request from '@/utils/http'
import type {
  LoginStatusVo,
  LoginResultsVo,
  LoginRequestCommand,
  TokenVo
} from '@/types/auth'

// ==================== 响应包装类型 ====================

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// ==================== Token 管理（/wx-auth） ====================

export const wxAuthApi = {
  /**
   * 检验 Token 是否有效
   */
  active: () =>
    request.get<ApiResponse<boolean>>('/wx-auth/v1/active'),

  /**
   * 用 wx.login 的 code 换取 JWT
   */
  getToken: (wxCode: string) =>
    request.post<ApiResponse<TokenVo>>('/wx-auth/v1/get-token', { wxCode }),

  /**
   * 刷新过期 Token
   */
  refreshToken: (wxCode: string) =>
    request.post<ApiResponse<TokenVo>>('/wx-auth/v1/refresh-token', { wxCode }),
}

// ==================== 认证管理（/auth） ====================

export const authApi = {
  // ---------- 状态查询 ----------

  /**
   * 获取登录状态（轻量级，优先读缓存）
   */
  getStatus: () =>
    request.get<ApiResponse<LoginStatusVo>>('/auth/v1/status'),

  /**
   * 获取历史登录过的学号列表
   */
  getHistory: () =>
    request.get<ApiResponse<string[]>>('/auth/v1/history'),

  // ---------- 会话管理 ----------

  /**
   * 初始化会话（强制重建 Cookie）
   */
  initSession: () =>
    request.post<ApiResponse<LoginResultsVo>>('/auth/v1/session/init'),

  /**
   * 刷新会话（仅刷新 SESSION_ID）
   */
  refreshSession: () =>
    request.post<ApiResponse<LoginResultsVo>>('/auth/v1/session/refresh'),

  // ---------- 登录/登出 ----------

  /**
   * 请求发送短信验证码
   */
  requestSms: (userId: string) =>
    request.post<ApiResponse<void>>('/auth/v1/request/sms', { userId }),

  /**
   * 登录学校系统
   */
  login: (params: LoginRequestCommand) =>
    request.post<ApiResponse<LoginResultsVo>>('/auth/v1/login', params),

  /**
   * 登出学校系统
   */
  logout: (params: Partial<LoginRequestCommand>) =>
    request.post<ApiResponse<LoginResultsVo>>('/auth/v1/logout', params),
}

// ==================== 教务管理（/acdm） ====================

export const academicApi = {
  /**
   * 刷新教务 Cookie
   */
  refreshCookies: () =>
    request.post<ApiResponse<void>>('/acdm/v1/refresh/cookies'),

  /**
   * 获取课表
   */
  getSchedule: (params?: { week?: number; semester?: string }) =>
    request.get<ApiResponse<any>>('/acdm/v1/schedule', { params }),
}