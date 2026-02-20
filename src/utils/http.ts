/**
 * Axios HTTP 封装（支持接口级超时）
 * 
 * 文件：src/utils/http/index.ts
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getToken, removeToken } from '@/utils/storage'

// ==================== 超时配置 ====================

/** 默认超时（毫秒）—— 普通接口 */
const DEFAULT_TIMEOUT = 15 * 1000

/** 慢接口超时（毫秒）—— 比后端 90s 多 10s 缓冲 */
const SLOW_TIMEOUT = 100 * 1000

/** 需要长超时的接口列表 */
const SLOW_APIS = [
  '/auth/v1/session/init',
  '/auth/v1/cookie/refresh',  // 兼容旧接口
]

// ==================== 创建实例 ====================

const instance: AxiosInstance = axios.create({
  baseURL: 'http://192.168.3.35:8080',
  timeout: DEFAULT_TIMEOUT,
  adapter: createUniAppAxiosAdapter(),
})

// ==================== 请求拦截器 ====================

instance.interceptors.request.use(
  (config) => {
    // 1. 为慢接口设置长超时
    const url = config.url || ''
    if (SLOW_APIS.some(api => url.includes(api))) {
      config.timeout = SLOW_TIMEOUT
      console.log(`[HTTP] 慢接口，超时设置为 ${SLOW_TIMEOUT / 1000}s: ${url}`)
    }

    // 2. 添加 Token
    const token = getToken()
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ==================== 响应拦截器 ====================

instance.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    
    // 业务状态码检查
    if (data.code && data.code !== 200) {
      // 504 网关超时，给出明确提示
      if (data.code === 504) {
        return Promise.reject({
          code: 504,
          message: data.message || '学校服务器响应超时，请稍后重试',
          retryable: true,
        })
      }
      
      return Promise.reject({
        code: data.code,
        message: data.message || '请求失败',
      })
    }
    
    return data
  },
  (error) => {
    // 网络错误或超时
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject({
        code: 504,
        message: '请求超时，请检查网络后重试',
        retryable: true,
      })
    }

    // HTTP 状态码错误
    const status = error.response?.status
    const data = error.response?.data

    if (status === 401) {
      // Token 过期，清除本地存储
      removeToken()
      return Promise.reject({
        code: 401,
        message: '登录已过期，请重新登录',
      })
    }

    if (status === 504) {
      return Promise.reject({
        code: 504,
        message: data?.message || '学校服务器响应超时，请稍后重试',
        retryable: true,
      })
    }

    return Promise.reject({
      code: status || 500,
      message: data?.message || error.message || '网络错误',
    })
  }
)

// ==================== 导出 ====================

export default instance

/** 请求方法快捷方式 */
export const request = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => 
    instance.get<any, T>(url, config),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    instance.post<any, T>(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    instance.put<any, T>(url, data, config),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => 
    instance.delete<any, T>(url, config),
}