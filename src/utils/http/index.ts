/**
 * HTTP 请求封装
 *
 * 核心功能：
 * 1. 每个请求自动附加 Token（请求拦截器）
 * 2. 统一处理 401 过期（响应拦截器）
 * 3. 自动显示/隐藏加载动画
 *
 * 使用方式（在 api/ 文件夹中调用）：
 *   import { get, post } from '@/utils/http'
 *   const res = await get<UserInfo>('/user/info')
 */
import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getToken, setToken, removeToken } from '../storage'

// ====== 你的胶水层后端返回的统一格式 ======
// 根据你实际的后端接口调整这个 interface
export interface ApiResult<T = any> {
  code: number       // 200 成功，401 token过期，其他是业务错误
  message: string
  data: T
}

// ====== 创建 Axios 实例 ======
const instance = axios.create({
  baseURL: 'http://192.168.3.35:8080',
  timeout: 15000,
  adapter: createUniAppAxiosAdapter(),  // 改这里，要加括号调用
})

// ====== 请求拦截器：发请求之前执行 ======
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 自动附加 Token
    const token = getToken()
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    // 显示加载动画
    uni.showLoading({ title: '加载中...', mask: true })
    return config
  },
  (error) => {
    uni.hideLoading()
    return Promise.reject(error)
  }
)

// ====== 响应拦截器：收到响应后执行 ======
instance.interceptors.response.use(
  (response: AxiosResponse<ApiResult>) => {
    uni.hideLoading()
    const res = response.data

    // 正常返回
    if (res.code === 200) {
      return res as any
    }

    // Token 过期
    if (res.code === 401) {
      handleExpired()
      return Promise.reject(new Error('登录已过期'))
    }

    // 其他业务错误，弹提示
    uni.showToast({ title: res.message || '请求失败', icon: 'none' })
    return Promise.reject(new Error(res.message))
  },
  (error) => {
    uni.hideLoading()
    // 网络层错误（断网、超时等）
    const status = error?.response?.status
    if (status === 401) {
      handleExpired()
    } else {
      uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    }
    return Promise.reject(error)
  }
)

// ====== Token 过期处理 ======
function handleExpired() {
  removeToken()
  uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/login/index' })
  }, 1500)
}

// ====== 对外暴露的快捷方法 ======
// 在 api/ 中这样用：
//   import { get, post } from '@/utils/http'
//   const res = await get<UserInfo>('/user/info')
//   console.log(res.data)  // 有类型提示！

export function get<T = any>(api: string, params?: any) {
  return instance.get<any, ApiResult<T>>(api, { params })
}

export function post<T = any>(api: string, data?: any) {
  return instance.post<any, ApiResult<T>>(api, data)
}

export function put<T = any>(api: string, data?: any) {
  return instance.put<any, ApiResult<T>>(api, data)
}

export function del<T = any>(api: string, params?: any) {
  return instance.delete<any, ApiResult<T>>(api, { params })
}

export default instance
