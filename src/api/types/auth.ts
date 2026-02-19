/**
 * 认证相关类型定义（修复版）
 * 
 * 文件：src/api/types/auth.ts
 */

/** 登录方式 */
export type LoginType = 'SMS' | 'PASSWORD'

/** 用户信息 */
export interface UserInfo {
  userId: string
  realName: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}

/** 
 * 登录状态 VO（修复版 - 包含用户信息）
 * 
 * GET /auth/v1/status 返回
 */
export interface LoginStatusVo {
  /** 是否已登录 */
  logined: boolean
  /** 可用登录方式 */
  loginTypes?: LoginType[]
  /** 状态检查时间 */
  statusTime?: number
  /** Cookie 是否即将过期 */
  cookieExpiringSoon?: boolean

  // ========== 用户信息（已登录时返回）==========

  /** 学号 */
  userId?: string
  /** 真实姓名 */
  realName?: string
  /** 性别 */
  gender?: string
  /** 学校名称 */
  schoolName?: string
  /** 头像 URL */
  avatarURL?: string
}

/** 
 * 登录结果 VO
 * 
 * POST /auth/v1/login 返回
 */
export interface LoginResultsVo {
  logined: boolean
  wxId?: string
  userId?: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
  loginTypes?: LoginType[]
}

/** Token 响应 */
export interface TokenVo {
  token: string
}

export interface LoginRequestCommand{
  userId:string
  password:string
  smsCode:string
  loginType:LoginType
}