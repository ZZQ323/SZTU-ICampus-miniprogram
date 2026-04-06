/**
 * Cookie 生命周期管理器
 *
 * 文件：src/utils/cookie-manager.ts
 *
 * 职责：
 *   1. 管理学校 cookies（明文 JSON）的本地存储
 *   2. 管理 openId 的本地存储
 *   3. 提供 header 附加方法
 *
 * 设计原则：
 *   - 不加密，明文存储（浏览器上 cookie 本身就是明文可见的）
 *   - 不做过期判断（后端根据学校返回内容判断 cookie 有效性）
 *   - 不依赖任何 store、不做 UI、不做导航
 */

const COOKIES_KEY = 'icampus_school_cookies'
const OPEN_ID_KEY = 'icampus_open_id'

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

// ==================== Open ID ====================

export function getOpenId(): string {
  return uni.getStorageSync(OPEN_ID_KEY) || ''
}

export function setOpenId(openId: string): void {
  uni.setStorageSync(OPEN_ID_KEY, openId)
}

export function removeOpenId(): void {
  uni.removeStorageSync(OPEN_ID_KEY)
}

export function hasOpenId(): boolean {
  return !!getOpenId()
}

// ==================== 清理 ====================

export function clearAuth(): void {
  removeSchoolCookies()
  removeOpenId()
}

// ==================== 状态检查 ====================

/** 是否有完整的认证信息（已登录过学校） */
export function hasAuth(): boolean {
  return hasOpenId() && hasSchoolCookies()
}
