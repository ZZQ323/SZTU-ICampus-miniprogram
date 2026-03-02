/**
 * HTTP 请求封装（增强版 - 修复类型问题）
 * 
 * 文件：src/utils/http/index.ts
 * 
 * 核心功能：
 * 1. 401 自动刷新 Token 并重试原请求
 * 2. 刷新期间的请求队列管理
 * 3. 统一的错误格式化
 * 4. 超时和网络错误的友好处理
 * 
 * ⭐ 重要：响应拦截器直接返回 response.data.data（业务数据）
 *    所以 API 调用时泛型直接写业务类型，如 request.get<UserInfo>()
 */

import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getToken, setToken } from '@/utils/storage'
import type { HttpError } from '@/types/auth'

// ==================== 配置常量 ====================

/** API 基础地址 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.3.35:8080'

/** 默认超时（毫秒）—— 普通接口 */
const DEFAULT_TIMEOUT = 15 * 1000

/** 慢接口超时（毫秒）—— 比后端 90s 多 10s 缓冲 */
const SLOW_TIMEOUT = 100 * 1000

/** 需要长超时的接口列表 */
const SLOW_APIS = [
  '/auth/v1/session/init',
  '/auth/v1/login',
  '/auth/v1/status',
  '/auth/v1/cookie/refresh',
  '/acdm/v1/schedule',
]

/** 不需要 Token 的公开接口 */
const PUBLIC_APIS = [
  '/wx-auth/v1/get-token',
  '/wx-auth/v1/refresh-token',
]

// ==================== 后端响应格式 ====================

/** 后端统一响应格式 */
interface BackendResponse<T = any> {
  code: number
  message: string
  data: T
}

// ==================== 刷新 Token 队列管理 ====================

/** 是否正在刷新 Token */
let isRefreshing = false

/** 等待刷新完成的请求队列 */
let pendingRequests: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  config: InternalAxiosRequestConfig
}> = []

/**
 * 执行队列中的所有请求
 */
function processPendingRequests(error?: any) {
  pendingRequests.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error)
    } else {
      // 更新 Token 后重试
      const newToken = getToken()
      if (newToken && config.headers) {
        config.headers['Authorization'] = `Bearer ${newToken}`
      }
      resolve(instance(config))
    }
  })
  pendingRequests = []
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

    // 1. 为慢接口设置长超时
    if (SLOW_APIS.some(api => url.includes(api))) {
      config.timeout = SLOW_TIMEOUT
      console.log(`[HTTP] 慢接口，超时设置为 ${SLOW_TIMEOUT / 1000}s: ${url}`)
    }

    // 2. 添加 Token（公开接口除外）
    const isPublicApi = PUBLIC_APIS.some(api => url.includes(api))
    if (!isPublicApi) {
      const token = getToken()
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
    }

    // 3. 添加请求 ID（用于日志追踪）
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

    // 检查是否有新 Token（后端可能在某些响应中返回）
    const newToken = headers['x-new-token']
    if (newToken) {
      setToken(newToken)
      console.log('[HTTP] 收到新 Token，已更新')
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

    // ⭐⭐⭐ 关键修复：直接返回业务数据（data.data）
    // 这样 API 调用时：const user = await request.get<UserInfo>('/user')
    // user 的类型就是 UserInfo，而不是 { code, message, data: UserInfo }
    return data.data as any
  },
  async (error) => {
    const { config, response } = error

    // ========== 401 处理：自动刷新 Token ==========
    if (response?.status === 401 && config && !config._retry) {
      // 如果是公开接口的 401，不尝试刷新
      const url = config.url || ''
      if (PUBLIC_APIS.some(api => url.includes(api))) {
        return Promise.reject(createHttpError(401, '认证失败', false, error))
      }

      // 如果已经在刷新中，将请求加入队列
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject, config })
        })
      }

      isRefreshing = true
      config._retry = true

      try {
        // 尝试刷新 Token
        const refreshSuccess = await refreshToken()

        if (refreshSuccess) {
          // 刷新成功，处理队列中的请求
          processPendingRequests()

          // 更新当前请求的 Token 并重试
          const newToken = getToken()
          if (newToken && config.headers) {
            config.headers['Authorization'] = `Bearer ${newToken}`
          }
          return instance(config)
        } else {
          // 刷新失败，拒绝所有等待的请求
          const refreshError = createHttpError(401, '登录已过期，请重新登录', false)
          processPendingRequests(refreshError)
          return Promise.reject(refreshError)
        }
      } catch (refreshErr) {
        const refreshError = createHttpError(401, '刷新登录状态失败', false, refreshErr)
        processPendingRequests(refreshError)
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
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

/**
 * 创建标准化的 HTTP 错误对象
 */
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

/**
 * 判断错误码是否可重试
 */
function isRetryableCode(code: number): boolean {
  // 5xx 服务器错误和网络相关错误可重试
  return code >= 500 || code === 0 || code === 504 || code === 408
}

/**
 * 获取默认的错误消息
 */
function getDefaultErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: '请求参数错误',
    401: '身份验证失败',
    403: '没有访问权限',
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

/**
 * 生成请求 ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 刷新 Token
 * 注意：这里不能直接 import userStore，会造成循环依赖
 * 所以直接调用 API
 */
async function refreshToken(): Promise<boolean> {
  try {
    // 获取新的 wx code
    const loginResult = await uni.login()
    if (!loginResult.code) {
      console.error('[HTTP] 获取 wx code 失败')
      return false
    }

    // 调用刷新接口（直接用 axios，绕过拦截器）
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

// ==================== 导出 ====================

export default instance

/** 
 * 请求方法快捷方式
 * 
 * ⭐ 泛型 T 表示的是业务数据类型，不是完整响应体
 * 
 * 使用示例：
 * ```ts
 * // 返回 Promise<UserInfo>，不是 Promise<{ code, message, data: UserInfo }>
 * const user = await request.get<UserInfo>('/user/info')
 * console.log(user.name) // 直接访问
 * ```
 */
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

/** 
 * 判断错误是否可重试 
 * 供外部使用
 */
export function isRetryable(error: any): boolean {
  return error?.retryable === true
}

/**
 * 判断是否是认证错误
 */
export function isAuthError(error: any): boolean {
  return error?.code === 401
}

/**
 * 导出基础 URL（供 SSE 等场景使用）
 */
export { BASE_URL }