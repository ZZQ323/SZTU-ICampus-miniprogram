/**
 * 登录相关的类型定义
 * 相当于后端的 DTO / VO
 */

// 登录方式
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
  id: string
  name: string
  studentId: string
  avatar: string
}
