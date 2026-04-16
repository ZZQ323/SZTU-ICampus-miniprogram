/**
 * 认证相关 API（Cookie-in-Header 版）
 *
 * Cookies 通过 http.ts 拦截器自动附加到 X-School-Cookies header，
 * 后端通过 X-Set-Cookies response header 返回更新后的 cookies。
 * 不再手动传递 cookiesJson 参数。
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
   * cookies 通过 header 自动附加
   */
  requestSms: (userId: string) =>
    request.post<void>('/auth/v1/request/sms', { userId }),

  /**
   * 登录学校系统（公开接口）
   * cookies 通过 header 自动附加和接收
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
   * 初始化教务系统 Cookie（通过重定向链获取教务 cookie）
   * 必须在获取课表前调用一次
   */
  initAcademic: () =>
    request.get<LoginResultsVo>('/acdm/v1/refresh/cookies'),

  /**
   * 获取课表
   * @param week 周次（如 "1"）
   * @param semester 学期（如 "2025-2026-2"）
   * 不传参数则默认当前学期
   */
  getSchedule: (params?: { week?: string; semester?: string }) =>
    request.post<any>('/acdm/v1/schedule', params || {}),
}
