/**
 * 登录相关 API
 *
 * 调用方式：
 *   import { authApi } from '@/api/auth'
 *   const res = await authApi.check()
 */
import http from '@/utils/http'
import type { LoginRequestCommand, SessionStatus, TokenAuthVo } from './types/auth'

// === WxAuthController ===
export const wxAuthApi = {
  /** 检验 token 是否有效 */
  checkActive: () => http.get<boolean>('/wx-auth/v1/active'),
  /** 获取 token */
  getToken: (wxCode: string) => http.post<TokenAuthVo>('/wx-auth/v1/get-token', { wxCode }),
  /** 刷新 token */
  refreshToken: (wxCode: string) => http.post<TokenAuthVo>('/wx-auth/v1/refresh-token', { wxCode }),
}

// === AuthController ===
export const authApi = {
  /** 获取学校 session 状态 */
  getSessionStatus: () => http.get<SessionStatus>('/auth/v1/status/session'),
  /** 获取历史学号 */
  getHistory: () => http.get<string[]>('/auth/v1/history'),
  /** 请求短信验证码 */
  requestSms: (userId: string) => http.post('/auth/v1/request/sms', { userId }),
  /** 刷新 cookie */
  refreshCookie: () => http.post('/auth/v1/cookie/refresh'),
  /** 登录 */
  login: (data: LoginRequestCommand) => http.post('/auth/v1/login', data),
  /** 登出 */
  logout: (userId: string) => http.post('/auth/v1/logout', { userId }),
}
