/**
 * HTTP 请求封装（Cookie-in-Header 版）
 *
 * 所有请求自动附加 X-School-Cookies + X-User-Id header（像浏览器一样）。
 * 响应中的 X-Set-Cookies header → 自动更新本地 cookie 存储。
 */

import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getUserId, getSchoolCookies, mergeSchoolCookies, setSchoolCookies, removeSchoolCookies } from '@/utils/cookie-manager'

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

    // cookie 诊断 log：每个 outgoing 请求附带的 cookie name 列表，方便对照后端
    // log（/proxy/attachment 报 cookies(total/matched)=4/4 时，能立刻知道前端
    // 究竟发的是哪 4 个）。
    if (cookies) {
      try {
        const arr = JSON.parse(cookies)
        const names = Array.isArray(arr) ? arr.map((c: any) => c?.name).join(',') : '?'
        console.log(`[http→] ${config.method?.toUpperCase()} ${url} cookies=${Array.isArray(arr) ? arr.length : 0} [${names}]`)
      } catch { /* ignore */ }
    } else {
      console.log(`[http→] ${config.method?.toUpperCase()} ${url} cookies=0`)
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
    // uni-app adapter 可能保留原始大小写，需要 case-insensitive 查找
    //
    // ⚠️ 默认按 (name,domain,path) 合并 —— 学校 Set-Cookie 只发增量，整体替换
    // 会把学校没重发的关键 cookie（比如一辈子只 set 一次的 TWFID）擦掉，
    // 下个请求带着"缺 TWFID 的子集"被学校 414。
    //
    // 例外：以下端点是"重置/重建会话"语义，要把本地旧 cookies **整体替换**，
    // 否则旧的 JSESSIONID / SESSION（已被学校服务端失效）会和新 cookies 一起发，
    // 学校 IDP 拿到一组矛盾 cookie 后直接返 HTML 登录页 → 登录卡死。
    //   - /auth/v1/session/init      重建匿名预登录会话
    //   - /auth/v1/login             登录成功后 session 全新，旧的 pre-login 票据可丢
    //   - /auth/v1/logout            登出后下一个 fetch 拿到的也是 fresh
    //   - /session/v1/reset          主动重置
    // refresh / status / 业务接口    走默认的合并语义
    const setCookies = _getHeader(headers, 'x-set-cookies')
    if (setCookies) {
      const url = (response.config?.url || '').toString()
      const isResetEndpoint =
        /\/auth\/v1\/(session\/init|login|logout)\b/.test(url) ||
        /\/session\/v1\/reset\b/.test(url)
      // 诊断 log：incoming X-Set-Cookies 的 name 列表 + 模式（replace/merge）
      try {
        const arr = JSON.parse(setCookies)
        const names = Array.isArray(arr) ? arr.map((c: any) => c?.name).join(',') : '?'
        console.log(`[http←] ${url} mode=${isResetEndpoint ? 'REPLACE' : 'merge'} incoming=${Array.isArray(arr) ? arr.length : 0} [${names}]`)
      } catch { /* ignore */ }

      if (isResetEndpoint) {
        removeSchoolCookies()
        setSchoolCookies(setCookies)
      } else {
        mergeSchoolCookies(setCookies)
      }
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

/** Case-insensitive header 读取（兼容 uni-app adapter 保留原始大小写） */
function _getHeader(headers: any, name: string): string | undefined {
  if (!headers) return undefined
  // 标准 axios（小写）
  if (headers[name]) return headers[name]
  // uni-app adapter 可能保留原始大小写
  const lowerName = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) return headers[key]
  }
  return undefined
}

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
