/**
 * 认证相关类型定义（完整版）
 * 
 * 文件：src/types/auth.ts
 */

// ==================== 基础类型 ====================

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

/** Token 响应 */
export interface TokenVo {
  token: string
  expiresIn?: number
}

/** 登录请求参数 */
export interface LoginRequestCommand {
  userId: string
  password?: string
  smsCode?: string
  loginType: LoginType
}

// ==================== 后端响应 VO ====================

/** 
 * 登录状态 VO
 * GET /auth/v1/status 返回
 */
export interface LoginStatusVo {
  logined: boolean
  loginTypes?: LoginType[]
  statusTime?: number
  cookieExpiringSoon?: boolean
  // 用户信息（已登录时返回）
  userId?: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}

/** 
 * 登录结果 VO
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

// ==================== 认证流程状态 ====================

/**
 * 认证阶段枚举
 * 
 * 状态转换图：
 * idle → checking-token → [refreshing-token] → checking-school → ready
 *                ↓                  ↓                   ↓
 *              error              error              need-login
 */
export type AuthPhase =
  | 'idle'              // 空闲状态
  | 'checking-token'    // 正在检查 Token
  | 'refreshing-token'  // 正在刷新 Token
  | 'checking-school'   // 正在检查学校登录状态
  | 'ready'             // 认证就绪
  | 'need-login'        // 需要登录学校
  | 'error'             // 发生错误

/**
 * 认证错误码
 */
export type AuthErrorCode =
  | 'NO_TOKEN'          // 没有 Token
  | 'TOKEN_EXPIRED'     // Token 已过期
  | 'TOKEN_INVALID'     // Token 无效
  | 'REFRESH_FAILED'    // Token 刷新失败
  | 'NETWORK_ERROR'     // 网络错误
  | 'TIMEOUT'           // 请求超时
  | 'SERVER_ERROR'      // 服务器错误
  | 'SCHOOL_SESSION_EXPIRED' // 学校 Session 过期
  | 'UNKNOWN'           // 未知错误

/**
 * 认证错误对象
 */
export interface AuthError {
  code: AuthErrorCode
  message: string
  retryable: boolean
  timestamp: number
  /** 原始错误（用于调试） */
  raw?: any
}

/**
 * HTTP 错误对象
 */
export interface HttpError {
  code: number
  message: string
  retryable: boolean
  timestamp: number
}

// ==================== useAuthGuard 相关 ====================

/**
 * ensure 方法的选项
 */
export interface EnsureOptions {
  /** 是否要求学校登录，默认 true */
  requireSchoolLogin?: boolean
  /** 失败时是否自动跳转登录页，默认 true */
  redirectOnFail?: boolean
  /** 静默模式（不显示遮罩），默认 false */
  silent?: boolean
}

/**
 * ensure 方法的返回结果
 */
export interface EnsureResult {
  /** 是否成功 */
  success: boolean
  /** 失败原因 */
  reason?: 'NO_TOKEN' | 'TOKEN_INVALID' | 'NEED_LOGIN' | 'ERROR'
  /** 登录状态（如果检查了的话） */
  status?: LoginStatusVo
  /** 错误信息（如果有的话） */
  error?: AuthError
}

/**
 * 重试上下文
 */
export interface RetryContext {
  /** 重试的操作类型 */
  operation: 'ensure' | 'request'
  /** 重试次数 */
  retryCount: number
  /** 最大重试次数 */
  maxRetries: number
  /** 原始参数 */
  params?: any
}