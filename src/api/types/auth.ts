/**
 * 前端类型定义（对应后端 VO）- 重构版
 * 
 * 文件：src/api/types/auth.ts
 */

/** 登录方式枚举 */
export type LoginType = 'SMS' | 'PASSWORD'

/** 登录请求参数 */
export interface LoginRequestCommand {
  userId: string
  password?: string
  smsCode?: string
  loginType: LoginType
}

/** Token 认证响应 */
export interface TokenAuthVo {
  token: string
  expiresIn: number
}

/** 
 * 登录状态查询响应（轻量级，可缓存）
 * 
 * 对应后端 LoginStatusVo
 * 用于 GET /auth/v1/status 接口
 */
export interface LoginStatusVo {
  /** 是否已登录学校后端 */
  logined: boolean
  /** 可用的登录方式（仅未登录时有意义） */
  loginTypes?: LoginType[]
  /** 状态获取时间戳 */
  statusTime?: number
  /** Cookie 是否即将过期（前端可据此提前刷新） */
  cookieExpiringSoon?: boolean
}

/** 
 * 登录结果/完整会话信息
 * 
 * 对应后端 LoginResultsVo
 * 用于 POST /auth/v1/session/init、/session/refresh、/login 等接口
 */
export interface LoginResultsVo {
  /** 是否已登录（注意：后端字段名是 logined，不是 isLogined） */
  logined: boolean
  wxId?: string
  userId?: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
  coments?: string
  loginTypes?: LoginType[]
}

/** 用户信息（前端使用） */
export interface UserInfo {
  userId: string
  realName: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}