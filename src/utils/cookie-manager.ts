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

/**
 * 合并式写入 cookies —— 镜像浏览器原生 Set-Cookie 语义。
 *
 * ⚠️ 关键 bug 修复（2026-04-25）：HAR 实证学校的 logout / re-login 流程里 Set-Cookie
 * **只返回变化的 key**（尤其 TWFID 这条 webvpn 根 cookie 一辈子只在最初的
 * thdportal_validate 那一跳 set 一次，此后所有流程都不再 re-issue）。浏览器按
 * (name, domain, path) 合并，不碰的 key 就保留旧值。
 *
 * 我们之前在 http.ts 响应拦截器里是"整体替换"：只要某个 API 返回 X-Set-Cookies 的子集
 * （例如公文通列表拉完只回了 2-4 个 cookie），前端就把 TWFID 擦了；紧接着附件 / 课表
 * 请求就发着缺 TWFID 的子集，学校 414 拒绝。
 *
 * 合并策略：
 *   - (name, domain, path) 三元组作为 cookie 唯一键
 *   - incoming 里有这个键 → 覆盖（按 school 的新值）
 *   - incoming 里没这个键 → 保留 existing（浏览器语义：server 没说删就继续带着）
 *
 * 若要完全清空（logout / reset），走 {@link removeSchoolCookies} / {@link clearAuth}。
 */
export function mergeSchoolCookies(incomingJson: string): void {
  if (!incomingJson) return
  const existing = parseCookieArray(getSchoolCookies())
  const incoming = parseCookieArray(incomingJson)

  const byKey = new Map<string, any>()
  for (const c of existing) byKey.set(cookieKey(c), c)
  for (const c of incoming) byKey.set(cookieKey(c), c)

  const merged = [...byKey.values()]
  uni.setStorageSync(COOKIES_KEY, JSON.stringify(merged))
}

function cookieKey(c: any): string {
  const name = c?.name ?? ''
  const domain = c?.domain ?? ''
  const path = c?.path ?? '/'
  return `${name}\t${domain}\t${path}`
}

function parseCookieArray(json: string): any[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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
