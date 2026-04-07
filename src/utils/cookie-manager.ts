/**
 * Cookie 生命周期管理器
 *
 * 文件：src/utils/cookie-manager.ts
 *
 * 职责：
 *   1. 管理学校 cookies（明文 JSON）的本地存储
 *   2. 管理 userId（学号）的本地存储
 *
 * 设计原则：
 *   - 不加密，明文存储（浏览器上 cookie 本身就是明文可见的）
 *   - 不做过期判断（后端根据学校返回内容判断 cookie 有效性）
 *   - 不依赖任何 store、不做 UI、不做导航
 */

const COOKIES_KEY = 'icampus_school_cookies'
const USER_ID_KEY = 'icampus_user_id'

// ==================== School Cookies ====================

export function getSchoolCookies(): string {
  return uni.getStorageSync(COOKIES_KEY) || ''
}

export function setSchoolCookies(cookiesJson: string): void {
  uni.setStorageSync(COOKIES_KEY, cookiesJson)
}

export function removeSchoolCookies(): void {
  uni.removeStorageSync(COOKIES_KEY)
}

export function hasSchoolCookies(): boolean {
  return !!getSchoolCookies()
}

// ==================== User ID（学号） ====================

export function getUserId(): string {
  return uni.getStorageSync(USER_ID_KEY) || ''
}

export function setUserId(userId: string): void {
  uni.setStorageSync(USER_ID_KEY, userId)
}

export function removeUserId(): void {
  uni.removeStorageSync(USER_ID_KEY)
}

// ==================== 清理 ====================

export function clearAuth(): void {
  removeSchoolCookies()
  removeUserId()
}

// ==================== 状态检查 ====================

/** 是否有认证信息（cookies 存在即可尝试请求） */
export function hasAuth(): boolean {
  return hasSchoolCookies()
}
