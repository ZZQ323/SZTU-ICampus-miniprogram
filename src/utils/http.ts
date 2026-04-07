/**
 * HTTP 请求封装（Cookie-in-Header 版）
 *
 * 所有请求自动附加 X-School-Cookies + X-User-Id header（像浏览器一样）。
 * 响应中的 X-Set-Cookies header → 自动更新本地 cookie 存储。
 */

import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getUserId, getSchoolCookies, setSchoolCookies } from '@/utils/cookie-manager'

// ==================== 配置 ====================

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.3.35:8080'
const DEFAULT_TIMEOUT = 15 * 1000
const SLOW_TIMEOUT = 100 * 1000

const SLOW_APIS = [
  '/auth/v1/session/init',
  '/auth/v1/session/refresh',
  '/auth/v1/login',
  '/auth/v1/status',
  '/acdm/v1/schedule',
]

// ==================== 后端响应格式 ====================

interface BackendResponse<T = any> {
  code: number
  message: string
  data: T
}

// ==================== Axios 实例 ====================

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  adapter: createUniAppAxiosAdapter(),
})

// ==================== 请求拦截器 ====================

instance.interceptors.request.use(
  (config) => {
    const url = config.url || ''

    // 慢接口加长超时
    if (SLOW_APIS.some(api => url.includes(api))) {
      config.timeout = SLOW_TIMEOUT
    }

    // 所有请求都附加 cookies header（像浏览器一样）
    const userId = getUserId()
    const cookies = getSchoolCookies()
    if (userId && config.headers) {
      config.headers['X-User-Id'] = userId
    }
    if (cookies && config.headers) {
      config.headers['X-School-Cookies'] = cookies
    }

    return config
  },
  (error) => Promise.reject(_makeError(0, '请求配置错误', false, error))
)

// ==================== 响应拦截器 ====================

instance.interceptors.response.use(
  // ===== 成功响应 =====
  (response: AxiosResponse<BackendResponse>) => {
    const { data, headers } = response

    // 后端通过 header 下发更新的 cookies → 更新本地存储
    const setCookies = headers['x-set-cookies'] || headers['x-updated-cookies']
    if (setCookies) {
      setSchoolCookies(setCookies)
    }

    // 业务错误码
    if (data.code !== undefined && data.code !== 200) {
      return Promise.reject(_makeError(data.code, data.message || '请求失败', false, data))
    }

    // 返回业务数据（已解包）
    return data.data as any
  },

  // ===== 错误响应 =====
  async (error) => {
    const { response } = error

    // ==================== 超时 ====================
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject(_makeError(504, '请求超时，请检查网络', true, error))
    }

    // ==================== 网络错误 ====================
    if (error.message === 'Network Error' || !response) {
      return Promise.reject(_makeError(0, '网络连接失败', true, error))
    }

    // ==================== 其他 HTTP 错误 ====================
    const status = response?.status || 500
    const msg = response?.data?.message || _defaultMsg(status)
    return Promise.reject(_makeError(status, msg, status >= 500, error))
  }
)

// ==================== 工具函数 ====================

function _makeError(code: number, message: string, retryable: boolean, raw?: any) {
  return { code, message, retryable, timestamp: Date.now(), raw }
}

function _defaultMsg(status: number): string {
  const m: Record<number, string> = {
    400: '请求参数错误', 401: '身份验证失败', 403: '会话已过期',
    404: '资源不存在', 429: '请求过于频繁', 500: '服务器错误',
    502: '网关错误', 503: '服务不可用', 504: '网关超时',
  }
  return m[status] || `请求失败 (${status})`
}

// ==================== 导出 ====================

export default instance

export const request = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    instance.get(url, config),
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    instance.post(url, data, config),
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    instance.put(url, data, config),
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    instance.delete(url, config),
}

/** 错误类型判断（页面 catch 里用） */
export function isRetryable(e: any): boolean { return e?.retryable === true }
