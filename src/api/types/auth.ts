/**
 * 登录相关的类型定义
 * 相当于后端的 DTO / VO
 */

// 登录方式
/** 登录方式枚举 */
export type LoginMethod = 'password' | 'sms'



// 登录检查结果（胶水层返回）
export interface CheckResult {
  needLogin: boolean
  loginMethod: LoginMethod
  newToken?: string
}

// 登录成功后返回
export interface LoginResult {
  token: string
  userInfo: UserInfo
}

// 用户信息
export interface UserInfo {
  usrId: string
  name: string
  avatarURL?: string
  schoolName:string
  loginStatus:boolean
}

/** 登录请求参数 */
export interface LoginRequestCommand {
  userId: string
  password?: string
  smsCode?: string
}

/** Token 返回 */
export interface TokenAuthVo {
  token: string
  expiresIn: number
}

/** Session 状态 */
export interface SessionStatus {
  isLoggedIn: boolean
  loginMethod?: 'sms' | 'password'
  userId?: string
}

