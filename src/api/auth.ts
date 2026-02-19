/**
 * 认证相关 API（重构版）
 * 
 * 文件：src/api/auth.ts
 * 
 * 接口拆分说明：
 * - GET  /auth/v1/status          - 状态查询（轻量，可缓存）
 * - POST /auth/v1/session/init    - 会话初始化（首次/重建 Cookie）
 * - POST /auth/v1/session/refresh - 会话刷新（仅刷新已登录会话）
 */

import request from '@/utils/http'
import type { 
  LoginStatusVo, 
  LoginResultsVo, 
  LoginRequestCommand, 
  TokenVo 
} from './types/auth'

// ==================== Token 管理（/wx-auth） ====================

export const wxAuthApi = {
  /**
   * 检验 token 是否有效
   */
  active: () => request.get<boolean>('/wx-auth/v1/active'),

  /**
   * 用 wx.login 的 code 换取 JWT
   */
  getToken: (wxCode: string) => 
    request.post<TokenVo>('/wx-auth/v1/get-token', { wxCode }),

  /**
   * 刷新过期 token
   */
  refreshToken: (wxCode: string) => 
    request.post<TokenVo>('/wx-auth/v1/refresh-token', { wxCode }),
}

// ==================== 认证管理（/auth） ====================

export const authApi = {
  // ---------- 状态查询 ----------

  /**
   * 获取登录状态（轻量级，优先读缓存）
   * 
   * 前端可高频调用此接口检查状态，不会每次触发后端 Playwright。
   * 返回内容包含：是否已登录、可用登录方式、Cookie 是否即将过期。
   */
  getStatus: () => 
    request.get<LoginStatusVo>('/auth/v1/status'),

  /**
   * 获取历史登录过的学号列表
   */
  getHistory: () => 
    request.get<string[]>('/auth/v1/history'),

  // ---------- 会话管理 ----------

  /**
   * 初始化会话（强制重建 Cookie）
   * 
   * 使用场景：
   * - 首次进入需要登录的模块
   * - Cookie 已过期或失效
   * - 前端主动请求重新初始化
   */
  initSession: () => 
    request.post<LoginResultsVo>('/auth/v1/session/init'),

  /**
   * 刷新会话（仅刷新 SESSION_ID）
   * 
   * 前置条件：当前已登录学校后端。
   * 如果会话已过期，返回错误码引导前端走登录流程。
   */
  refreshSession: () => 
    request.post<LoginResultsVo>('/auth/v1/session/refresh'),

  // ---------- 登录/登出 ----------

  /**
   * 请求发送短信验证码
   */
  requestSms: (userId: string) => 
    request.post<void>('/auth/v1/request/sms', { userId }),

  /**
   * 登录学校系统
   */
  login: (params: LoginRequestCommand) => 
    request.post<LoginResultsVo>('/auth/v1/login', params),

  /**
   * 登出学校系统
   */
  logout: (params: Partial<LoginRequestCommand>) => 
    request.post<LoginResultsVo>('/auth/v1/logout', params),

  // ---------- 兼容旧接口（已废弃） ----------

  /**
   * @deprecated 请使用 initSession()
   */
  refreshCookie: () => 
    request.post<LoginResultsVo>('/auth/v1/cookie/refresh'),

  /**
   * @deprecated 请使用 getStatus()
   */
  getSessionStatus: () => 
    request.get<{ hasSession: boolean }>('/auth/v1/status/session'),
}