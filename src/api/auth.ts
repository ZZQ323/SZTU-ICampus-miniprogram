/**
 * 登录相关 API
 *
 * 调用方式：
 *   import { authApi } from '@/api/auth'
 *   const res = await authApi.check()
 */
import { get, post } from '@/utils/http'
import type { CheckResult, LoginResult } from './types/auth'

export const authApi = {
  /** 检查登录状态（胶水层判断 session 是否有效） */
  check: () => get<CheckResult>('/auth/check'),

  /** 账号密码登录 */
  loginByPassword: (username: string, password: string) =>
    post<LoginResult>('/auth/login/password', { username, password }),

  /** 短信验证码登录 */
  loginBySms: (phone: string, code: string) =>
    post<LoginResult>('/auth/login/sms', { phone, code }),

  /** 发送短信验证码（胶水层代理请求学校） */
  sendSmsCode: (phone: string) =>
    post('/auth/sms/send', { phone }),

  /** 刷新 Token */
  refreshToken: () =>
    post<{ token: string }>('/auth/refresh'),
}
