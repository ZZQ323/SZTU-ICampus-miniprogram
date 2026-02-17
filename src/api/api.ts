/**
 * 登录相关 API
 *
 * 调用方式：
 *   import { authApi } from '@/api/auth'
 *   const res = await authApi.check()
 */
import http from '@/utils/http'
import type { LoginRequestCommand, LoginResultsVo, TokenAuthVo, PossibleUsrIdVO } from './types/auth'

// === WxAuthController（/wx-auth） ===
export const wxAuthApi = {
  /** GET /wx-auth/v1/active - 检验 token 是否有效 */
  checkActive: () => http.get<boolean>('/wx-auth/v1/active'),

  /** POST /wx-auth/v1/get-token - 获取 token */
  getToken: (wxCode: string) => http.post<TokenAuthVo>('/wx-auth/v1/get-token', { wxCode }),

  /** POST /wx-auth/v1/refresh-token - 刷新 token */
  refreshToken: (wxCode: string) => http.post<TokenAuthVo>('/wx-auth/v1/refresh-token', { wxCode }),
}

// === AuthController（/auth） ===
export const authApi = {
  /** GET /auth/v1/status/session - 获取学校 session 状态 */
  getSessionStatus: () => http.get<LoginResultsVo>('/auth/v1/status/session'),

  /** GET /auth/v1/history - 获取历史学号 */
  getHistory: () => http.get<PossibleUsrIdVO>('/auth/v1/history'),

  /** POST /auth/v1/request/sms - 请求短信验证码 */
  requestSms: (userId: string) => http.post('/auth/v1/request/sms', { userId }),

  /** POST /auth/v1/cookie/refresh - 刷新 cookie */
  refreshCookie: () => http.post('/auth/v1/cookie/refresh'),

  /** POST /auth/v1/login - 登录学校系统 */
  login: (data: LoginRequestCommand) => http.post<LoginResultsVo>('/auth/v1/login', data),

  /** POST /auth/v1/logout - 登出 */
  logout: (userId: string) => http.post('/auth/v1/logout', { userId }),
}
