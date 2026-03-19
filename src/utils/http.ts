/**
 * HTTP 请求封装（修复版 - 防 401 风暴）
 * 
 * 文件：src/utils/http/index.ts
 * 
 * ⭐ 修复：
 * 1. handleAuthFailure() 加防重入锁 + 冷却期（5秒内不重复触发）
 * 2. refreshToken() 失败时不再 reLaunch（避免死循环），改为静默失败
 * 3. 401 处理添加最大重试限制
 */

import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getToken, setToken } from '@/utils/storage'

// ==================== 配置常量 ====================

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.3.35:8080'
const DEFAULT_TIMEOUT = 15 * 1000
const SLOW_TIMEOUT = 100 * 1000

const SLOW_APIS = [
  '/auth/v1/session/init',
  '/auth/v1/session/refresh',
  '/auth/v1/login',
  '/auth/v1/status',
  '/auth/v1/cookie/refresh',
  '/acdm/v1/schedule',
]

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

// ==================== 刷新队列管理 ====================

let isRefreshingToken = false
let isRefreshingSession = false

let pendingTokenRequests: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  config: InternalAxiosRequestConfig
}> = []

let pendingSessionRequests: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  config: InternalAxiosRequestConfig
}> = []

// ⭐ 防重入：handleAuthFailure 冷却期
let _authFailureHandled = false
let _authFailureCooldown = 0

function processTokenQueue(error?: any) {
  pendingTokenRequests.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error)
    } else {
      const newToken = getToken()
      if (newToken && config.headers) {
        config.headers['Authorization'] = `Bearer ${newToken}`
      }
      resolve(instance(config))
    }
  })
  pendingTokenRequests = []
}

function processSessionQueue(error?: any) {
  pendingSessionRequests.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error)
    } else {
      resolve(instance(config))
    }
  })
  pendingSessionRequests = []
}

// ==================== 创建 Axios 实例 ====================

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  adapter: createUniAppAxiosAdapter(),
})

// ==================== 请求拦截器 ====================

instance.interceptors.request.use(
  (config) => {
    const url = config.url || ''

    if (SLOW_APIS.some(api => url.includes(api))) {
      config.timeout = SLOW_TIMEOUT
    }

    const isPublicApi = PUBLIC_APIS.some(api => url.includes(api))
    if (!isPublicApi) {
      const token = getToken()
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    }

    config.headers = config.headers || {}
    config.headers['X-Request-ID'] = generateRequestId()

    return config
  },
  (error) => {
    return Promise.reject(createHttpError(0, '请求配置错误', false, error))
  }
)

// ==================== 响应拦截器 ====================

instance.interceptors.response.use(
  (response: AxiosResponse<BackendResponse>) => {
    const { data, headers } = response

    const newToken = headers['x-new-token']
    if (newToken) {
      setToken(newToken)
    }

    if (data.code !== undefined && data.code !== 200) {
      return Promise.reject(createHttpError(
        data.code,
        data.message || '请求失败',
        isRetryableCode(data.code),
        data
      ))
    }

    return data.data as any
  },
  async (error) => {
    const { config, response } = error

    // ========== 401 处理：刷新 Token ==========
    if (response?.status === 401 && config && !config._retryToken) {
      const url = config.url || ''

      if (PUBLIC_APIS.some(api => url.includes(api))) {
        return Promise.reject(createHttpError(401, '认证失败', false, error))
      }

      // ⭐ 如果已经在认证失败冷却期，直接拒绝，不再尝试刷新
      if (_authFailureHandled && Date.now() - _authFailureCooldown < 5000) {
        return Promise.reject(createHttpError(401, '登录已过期，请重新登录', false))
      }

      if (isRefreshingToken) {
        return new Promise((resolve, reject) => {
          pendingTokenRequests.push({ resolve, reject, config })
        })
      }

      isRefreshingToken = true
      config._retryToken = true

      try {
        const refreshSuccess = await refreshToken()

        if (refreshSuccess) {
          // ⭐ 刷新成功，清除失败标记
          _authFailureHandled = false
          processTokenQueue()
          const newToken = getToken()
          if (newToken && config.headers) {
            config.headers['Authorization'] = `Bearer ${newToken}`
          }
          return instance(config)
        } else {
          const refreshError = createHttpError(401, '登录已过期，请重新登录', false)
          processTokenQueue(refreshError)
          // ⭐ 标记失败 + 冷却期，不再 reLaunch（由调用方决定怎么处理）
          handleAuthFailure()
          return Promise.reject(refreshError)
        }
      } catch (refreshErr) {
        const refreshError = createHttpError(401, '刷新登录状态失败', false, refreshErr)
        processTokenQueue(refreshError)
        handleAuthFailure()
        return Promise.reject(refreshError)
      } finally {
        isRefreshingToken = false
      }
    }

    // ========== 403 处理：刷新 Session ==========
    if (response?.status === 403 && config && !config._retrySession) {
      console.log('[HTTP] 收到 403，Cookie 可能已过期，尝试重新初始化 Session')

      if (isRefreshingSession) {
        return new Promise((resolve, reject) => {
          pendingSessionRequests.push({ resolve, reject, config })
        })
      }

      isRefreshingSession = true
      config._retrySession = true

      try {
        const refreshSuccess = await refreshSession()

        if (refreshSuccess) {
          processSessionQueue()
          return instance(config)
        } else {
          const refreshError = createHttpError(403, '学校会话已过期，请重新登录', false)
          processSessionQueue(refreshError)
          return Promise.reject(refreshError)
        }
      } catch (refreshErr) {
        const refreshError = createHttpError(403, '重新初始化会话失败', false, refreshErr)
        processSessionQueue(refreshError)
        return Promise.reject(refreshError)
      } finally {
        isRefreshingSession = false
      }
    }

    // ========== 超时错误 ==========
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject(createHttpError(504, '请求超时，请检查网络后重试', true, error))
    }

    // ========== 网络错误 ==========
    if (error.message === 'Network Error' || !response) {
      return Promise.reject(createHttpError(0, '网络连接失败，请检查网络设置', true, error))
    }

    // ========== 其他 HTTP 错误 ==========
    const status = response?.status || 500
    const message = response?.data?.message || getDefaultErrorMessage(status)
    return Promise.reject(createHttpError(status, message, isRetryableCode(status), error))
  }
)

// ==================== 辅助函数 ====================

function createHttpError(code: number, message: string, retryable: boolean, raw?: any) {
  return { code, message, retryable, timestamp: Date.now(), raw }
}

function isRetryableCode(code: number): boolean {
  return code >= 500 || code === 0 || code === 504 || code === 408
}

function getDefaultErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: '请求参数错误',
    401: '身份验证失败',
    403: '学校会话已过期',
    404: '请求的资源不存在',
    408: '请求超时',
    429: '请求过于频繁，请稍后再试',
    500: '服务器内部错误',
    502: '网关错误',
    503: '服务暂时不可用',
    504: '网关超时'
  }
  return messages[status] || `请求失败 (${status})`
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 刷新 Token
 */
async function refreshToken(): Promise<boolean> {
  try {
    const loginResult = await uni.login()
    if (!loginResult.code) {
      console.error('[HTTP] 获取 wx code 失败')
      return false
    }

    const response = await axios.post<BackendResponse<{ token: string }>>(
      `${BASE_URL}/wx-auth/v1/refresh-token`,
      { wxCode: loginResult.code },
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        adapter: createUniAppAxiosAdapter(),
        timeout: DEFAULT_TIMEOUT
      }
    )

    if (response.data?.data?.token) {
      setToken(response.data.data.token)
      console.log('[HTTP] Token 刷新成功')
      return true
    }

    return false
  } catch (e) {
    console.error('[HTTP] Token 刷新失败', e)
    return false
  }
}

/**
 * 刷新 Session
 */
async function refreshSession(): Promise<boolean> {
  try {
    const response = await axios.post<BackendResponse<any>>(
      `${BASE_URL}/auth/v1/session/init`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        adapter: createUniAppAxiosAdapter(),
        timeout: SLOW_TIMEOUT
      }
    )

    if (response.data?.code === 200) {
      console.log('[HTTP] Session 重新初始化成功')
      return true
    }

    return false
  } catch (e) {
    console.error('[HTTP] Session 重新初始化失败', e)
    return false
  }
}

/**
 * ⭐ 处理认证失败（防重入版）
 * 
 * 不再 reLaunch！只做：
 * 1. 清除本地 token
 * 2. 设置冷却期（5秒内不再触发 refresh）
 * 3. 让调用方自己处理 UI（弹窗 / 跳登录页）
 */
function handleAuthFailure() {
  // 防重入：5秒内只处理一次
  const now = Date.now()
  if (_authFailureHandled && (now - _authFailureCooldown) < 5000) {
    return
  }

  _authFailureHandled = true
  _authFailureCooldown = now

  console.warn('[HTTP] 认证失败，清除本地 token')

  // 清除本地存储
  try {
    uni.removeStorageSync('token')
    uni.removeStorageSync('userInfo')
  } catch (e) {
    console.error('[HTTP] 清除存储失败', e)
  }

  // ⭐ 不再 reLaunch！前端 useAuthGuard 或页面级代码会根据 token 缺失自动响应
  // 如果需要提示用户，由调用方（页面组件）决定
}

/**
 * ⭐ 重置认证失败状态（登录成功后调用）
 */
export function resetAuthFailureState() {
  _authFailureHandled = false
  _authFailureCooldown = 0
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

export function isRetryable(error: any): boolean {
  return error?.retryable === true
}

export function isAuthError(error: any): boolean {
  return error?.code === 401
}

export function isSessionError(error: any): boolean {
  return error?.code === 403
}

export { BASE_URL }