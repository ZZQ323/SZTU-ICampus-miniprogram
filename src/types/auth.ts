/**
 * 认证相关类型定义
 *
 * 文件：src/types/auth.ts
 */

// ==================== 认证阶段 ====================

/** 认证阶段（简化版：无 token 相关阶段） */
export type AuthPhase =
  | 'idle'            // 空闲状态
  | 'checking-session'// 检查学校登录状态
  | 'ready'           // 认证完成，就绪
  | 'need-login'      // 需要登录
  | 'error'           // 发生错误

// ==================== 错误相关 ====================

/** 认证错误码（简化版：移除 token 相关） */
export type AuthErrorCode =
  | 'NETWORK_ERROR'         // 网络错误
  | 'TIMEOUT'               // 超时
  | 'SERVER_ERROR'          // 服务器错误
  | 'SCHOOL_SESSION_EXPIRED'// 学校会话过期
  | 'SESSION_INVALID'       // 会话无效（需要重新初始化）
  | 'CHECK_FAILED'          // 检查失败
  | 'UNKNOWN_ERROR'         // 未知错误
  | 'UNKNOWN'               // 未知错误（兼容）

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
  action: 'check-session' | 'login'
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

/** 登录请求参数 */
export interface LoginRequestParams {
  userId: string
  loginType: LoginType
  smsCode?: string
  password?: string
  /** 前端传来的预登录 cookies JSON */
  cookiesJson?: string
}

/** 登录状态 VO */
export interface LoginStatusVo {
  logined: boolean
  userId?: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
  loginTypes?: string[]
  /**
   * 会话是否无效（需要重新初始化）
   */
  sessionInvalid?: boolean
}

export interface UserInfo {
  userId: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
}

/** 登录结果 VO */
export interface LoginResultsVo {
  logined: boolean
  userId?: string
  realName?: string
  gender?: string
  schoolName?: string
  avatarURL?: string
  loginTypes?: string[]
  /** 学校 cookies（明文 JSON）—— 前端需存储 */
  cookiesJson?: string
  /** 会话是否无效（需要重新初始化） */
  sessionInvalid?: boolean
}

// ==================== 会话相关 ====================

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
