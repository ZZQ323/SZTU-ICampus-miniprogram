/**
 * HTTP 请求封装（三层分治版）
 *
 * 文件：src/utils/http/index.ts
 *
 * 职责（且仅此）：
 *   1. 请求时附加 token
 *   2. 401 时调 TokenManager 刷新 1 次，成功重试，失败 reject
 *   3. 其他错误原样 reject
 *
 * 禁止：
 *   - reLaunch / navigateTo / switchTab
 *   - uni.showToast / uni.showModal
 *   - removeStorageSync（不清 token，那是 TokenManager 的事）
 *   - 自动 initSession（那是页面守卫的事）
 */

import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getToken, setToken } from '@/utils/storage'
import { refreshToken as tmRefreshToken } from '@/utils/token-manager'

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

/** 公开接口：不附 token，401 不重试 */
const PUBLIC_APIS = [
  '/wx-auth/v1/get-token',
  '/wx-auth/v1/refresh-token',
]

// ==================== 后端响应格式 ====================

interface BackendResponse<T = any> {
  code: number
  message: string
  data: T
}

// ==================== 401 队列管理 ====================

let _isRefreshing = false

let _pendingRequests: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  config: InternalAxiosRequestConfig
}> = []

function _processPendingQueue(error?: any) {
  _pendingRequests.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error)
    } else {
      // 重新附上新 token
      const newToken = getToken()
      if (newToken && config.headers) {
        config.headers['Authorization'] = `Bearer ${newToken}`
      }
      resolve(instance(config))
    }
  })
  _pendingRequests = []
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

    // 非公开接口附 token
    if (!PUBLIC_APIS.some(api => url.includes(api))) {
      const token = getToken()
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
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

    // 如果后端通过 header 下发了新 token
    const newToken = headers['x-new-token']
    if (newToken) setToken(newToken)

    // 业务错误码
    if (data.code !== undefined && data.code !== 200) {
      return Promise.reject(_makeError(data.code, data.message || '请求失败', false, data))
    }

    // 返回业务数据（已解包）
    return data.data as any
  },

  // ===== 错误响应 =====
  async (error) => {
    const { config, response } = error

    // ==================== 401：调 TokenManager 刷新 ====================
    if (response?.status === 401 && config && !config._retried) {
      const url = config.url || ''

      // 公开接口的 401 不处理
      if (PUBLIC_APIS.some(api => url.includes(api))) {
        return Promise.reject(_makeError(401, '认证失败', false))
      }

      // 如果已经在刷新中，排队等待
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _pendingRequests.push({ resolve, reject, config })
        })
      }

      // 标记：这个请求已经重试过了
      _isRefreshing = true
      config._retried = true

      try {
        // ⭐ 委托 TokenManager 刷新（带锁，全局只跑一次）
        const ok = await tmRefreshToken()

        if (ok) {
          // 刷新成功，放行队列中的请求
          _processPendingQueue()

          // 重试当前请求
          const newToken = getToken()
          if (newToken && config.headers) {
            config.headers['Authorization'] = `Bearer ${newToken}`
          }
          return instance(config)
        }

        // 刷新失败 → reject 所有等待中的请求
        const err = _makeError(401, '登录已过期', false)
        _processPendingQueue(err)
        return Promise.reject(err)

      } catch (e) {
        const err = _makeError(401, '刷新登录状态失败', false, e)
        _processPendingQueue(err)
        return Promise.reject(err)
      } finally {
        _isRefreshing = false
      }
    }

    // ==================== 403：直接 reject（页面守卫决定怎么办） ====================
    if (response?.status === 403) {
      return Promise.reject(_makeError(403, '学校会话已过期', false, error))
    }

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
    400: '请求参数错误', 401: '身份验证失败', 403: '学校会话已过期',
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
export function isAuthError(e: any): boolean { return e?.code === 401 }
export function isSessionError(e: any): boolean { return e?.code === 403 }
export function isRetryable(e: any): boolean { return e?.retryable === true }