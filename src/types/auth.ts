/**
 * 认证相关类型定义
 * 
 * 文件：src/types/auth.ts
 */

// ==================== 认证阶段 ====================

/** 认证阶段 */
export type AuthPhase =
  | 'idle'            // 空闲状态
  | 'checking-token'  // 检查 Token 中
  | 'refreshing-token'// 刷新 Token 中
  | 'checking-school' // 检查学校登录状态
  | 'ready'           // 认证完成，就绪
  | 'need-login'      // 需要登录
  | 'error'           // 发生错误

// ==================== 错误相关 ====================

/** 认证错误码 */
export type AuthErrorCode =
  | 'NO_TOKEN'              // 无 Token
  | 'TOKEN_EXPIRED'         // Token 过期
  | 'TOKEN_INVALID'         // Token 无效
  | 'REFRESH_FAILED'        // 刷新失败
  | 'NETWORK_ERROR'         // 网络错误
  | 'TIMEOUT'               // 超时
  | 'SERVER_ERROR'          // 服务器错误
  | 'SCHOOL_SESSION_EXPIRED'// 学校会话过期
  | 'UNKNOWN'               // 未知错误
  | 'TOKEN_INIT_FAILED'
  | 'CHECK_FAILED'
  | 'UNKNOWN_ERROR'

/** 认证错误 */
export interface AuthError {
  code: AuthErrorCode
  message: string
  retryable: boolean
  timestamp: number
  raw?: any
}

// ==================== 重试上下文 ====================

/** 重试上下文 */
export interface RetryContext {
  /** 重试的操作类型 */
  action: 'check-token' | 'refresh-token' | 'check-school' | 'login'
  /** 重试次数 */
  retryCount: number
  /** 最大重试次数 */
  maxRetries: number
  /** 原始参数 */
  params?: any
}

// ==================== 登录相关 ====================

/** 登录方式 */
export type LoginType = 'SMS' | 'PASSWORD'

/** 登录请求参数 （对应后端 LoginRequestCommand） */
export interface LoginRequestParams {
  userId: string
  loginType: LoginType
  smsCode?: string
  password?: string
}

/** 登录状态 VO （对应后端 LoginStatusVo） */
export interface LoginStatusVo {
  logined: boolean           // 后端用 @JsonProperty("logined")
  loginTypes?: LoginType[]
  userId?: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}

/** 登录结果 VO  （对应后端 LoginResultsVo） */
export interface LoginResultsVo {
  logined: boolean           // 后端用 @JsonProperty("logined")
  wxId?: string
  loginTypes?: LoginType[]
  userId?: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}

/** 用户信息 */
export interface UserInfo {
  userId: string
  realName: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}

/** Token 响应 */
export interface TokenVo {
  token: string
  expiresIn?: number
}

// ==================== 会话相关 ====================

/** Token 响应 */
export interface TokenVo {
  token: string
  expiresIn?: number
}

/** 初始化会话结果 */
export interface InitSessionResult {
  logined: boolean
  loginTypes?: string[]
}

/** 检查会话结果 */
export interface CheckSessionResult {
  logined: boolean
  loginTypes?: string[]
  userId?: string
  realName?: string
}

// ==================== auth store 需要的类型 ====================

/** 认证错误 */
export interface AuthError {
  code: AuthErrorCode
  message: string
  retryable: boolean
  timestamp: number
  raw?: any
}

/** 重试上下文 */
export interface RetryContext {
  action: 'check-token' | 'refresh-token' | 'check-school' | 'login'
  retryCount: number
  maxRetries: number
  params?: any
}