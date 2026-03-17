/**
 * HTTP 请求封装（增强版 - 支持 401/403 区分处理）
 * 
 * 文件：src/utils/http/index.ts
 * 
 * 核心功能：
 * 1. 401 自动刷新 Token 并重试原请求
 * 2. 403 自动重新初始化 Session 并重试原请求
 * 3. 刷新期间的请求队列管理
 * 4. 统一的错误格式化
 * 
 * 错误码约定：
 * - 401: Token 无效/过期 → 刷新 Token
 * - 403: Cookie 无效/过期 → 重新初始化 Session
 */

import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getToken, setToken } from '@/utils/storage'
import type { HttpError } from '@/types/auth'

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

/** 是否正在刷新 Token */
let isRefreshingToken = false

/** 是否正在刷新 Session */
let isRefreshingSession = false

/** 等待 Token 刷新完成的请求队列 */
let pendingTokenRequests: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  config: InternalAxiosRequestConfig
}> = []

/** 等待 Session 刷新完成的请求队列 */
let pendingSessionRequests: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  config: InternalAxiosRequestConfig
}> = []

/**
 * 处理 Token 刷新后的队列
 */
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

/**
 * 处理 Session 刷新后的队列
 */
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

    // 为慢接口设置长超时
    if (SLOW_APIS.some(api => url.includes(api))) {
      config.timeout = SLOW_TIMEOUT
    }

    // 添加 Token
    const isPublicApi = PUBLIC_APIS.some(api => url.includes(api))
    if (!isPublicApi) {
      const token = getToken()
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    }

    // 添加请求 ID
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

    // 检查是否有新 Token
    const newToken = headers['x-new-token']
    if (newToken) {
      setToken(newToken)
    }

    // 业务状态码检查
    if (data.code !== undefined && data.code !== 200) {
      return Promise.reject(createHttpError(
        data.code,
        data.message || '请求失败',
        isRetryableCode(data.code),
        data
      ))
    }

    // 返回业务数据
    return data.data as any
  },
  async (error) => {
    const { config, response } = error

    // ========== 401 处理：刷新 Token ==========
    if (response?.status === 401 && config && !config._retryToken) {
      const url = config.url || ''

      // 公开接口的 401 不处理
      if (PUBLIC_APIS.some(api => url.includes(api))) {
        return Promise.reject(createHttpError(401, '认证失败', false, error))
      }

      // 如果已经在刷新 Token，加入队列等待
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
          processTokenQueue()
          const newToken = getToken()
          if (newToken && config.headers) {
            config.headers['Authorization'] = `Bearer ${newToken}`
          }
          return instance(config)
        } else {
          const refreshError = createHttpError(401, '登录已过期，请重新登录', false)
          processTokenQueue(refreshError)
          // 清除本地状态，跳转登录
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

    // ========== 403 处理：刷新 Session（Cookie 过期） ==========
    if (response?.status === 403 && config && !config._retrySession) {
      console.log('[HTTP] 收到 403，Cookie 可能已过期，尝试重新初始化 Session')

      // 如果已经在刷新 Session，加入队列等待
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
          // 跳转登录页
          navigateToLogin()
          return Promise.reject(refreshError)
        }
      } catch (refreshErr) {
        const refreshError = createHttpError(403, '重新初始化会话失败', false, refreshErr)
        processSessionQueue(refreshError)
        navigateToLogin()
        return Promise.reject(refreshError)
      } finally {
        isRefreshingSession = false
      }
    }

    // ========== 超时错误 ==========
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject(createHttpError(
        504,
        '请求超时，请检查网络后重试',
        true,
        error
      ))
    }

    // ========== 网络错误 ==========
    if (error.message === 'Network Error' || !response) {
      return Promise.reject(createHttpError(
        0,
        '网络连接失败，请检查网络设置',
        true,
        error
      ))
    }

    // ========== 其他 HTTP 错误 ==========
    const status = response?.status || 500
    const message = response?.data?.message || getDefaultErrorMessage(status)

    return Promise.reject(createHttpError(
      status,
      message,
      isRetryableCode(status),
      error
    ))
  }
)

// ==================== 辅助函数 ====================

function createHttpError(
  code: number,
  message: string,
  retryable: boolean,
  raw?: any
): HttpError {
  return {
    code,
    message,
    retryable,
    timestamp: Date.now()
  }
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
 * 刷新 Session（重新初始化 Cookie）
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
 * 处理认证失败（401 无法恢复）
 */
function handleAuthFailure() {
  // 清除本地存储
  try {
    uni.removeStorageSync('token')
    uni.removeStorageSync('userInfo')
  } catch (e) {
    console.error('[HTTP] 清除存储失败', e)
  }

  // 跳转到首页（让用户重新走流程）
  uni.reLaunch({ url: '/pages/home/home' })
}

/**
 * 跳转到登录页
 */
function navigateToLogin() {
  uni.navigateTo({
    url: '/pages/common/login/login',
    fail: () => {
      uni.redirectTo({ url: '/pages/common/login/login' })
    }
  })
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