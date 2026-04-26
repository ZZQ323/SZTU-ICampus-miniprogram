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
 * 合并语义（对齐浏览器）：
 *   - 同 (name, domain, path) → 用 incoming 覆盖
 *   - incoming 里没这个键 → 保留 existing
 *   - incoming 的某条 cookie 是**过期**（expires 已过）或 **value 为空**
 *     → 视为"删除"，从 jar 里抹掉，不写入垃圾占位
 *
 * 若要完全清空（logout / reset），走 {@link removeSchoolCookies} / {@link clearAuth}。
 */
export function mergeSchoolCookies(incomingJson: string): void {
  if (!incomingJson) return
  const existing = parseCookieArray(getSchoolCookies())
  const incoming = parseCookieArray(incomingJson)

  console.log(`[cookie-merge] BEGIN existing=${existing.length} incoming=${incoming.length}`)
  console.log('[cookie-merge] incoming raw:', incomingJson.length > 1500 ? incomingJson.substring(0, 1500) + '...(truncated)' : incomingJson)

  const byKey = new Map<string, any>()
  for (const c of existing) {
    if (isCookieDead(c)) {
      console.log(`[cookie-merge] existing DEAD-skipped name=${c?.name} reason=${describeDead(c)}`)
      continue
    }
    byKey.set(cookieKey(c), c)
  }

  let added = 0, replaced = 0, deleted = 0, skippedDead = 0
  for (const c of incoming) {
    const key = cookieKey(c)
    if (isCookieDead(c)) {
      const wasDeleted = byKey.delete(key)
      console.log(`[cookie-merge] incoming DEAD name=${c?.name} reason=${describeDead(c)} (existed=${wasDeleted})`)
      if (wasDeleted) deleted++
      else skippedDead++
      continue
    }
    if (byKey.has(key)) {
      replaced++
      console.log(`[cookie-merge] REPLACE name=${c.name} domain=${c.domain} path=${c.path}`)
    } else {
      added++
      console.log(`[cookie-merge] ADD name=${c.name} domain=${c.domain} path=${c.path}`)
    }
    byKey.set(key, c)
  }

  const merged = [...byKey.values()]
  uni.setStorageSync(COOKIES_KEY, JSON.stringify(merged))
  console.log(`[cookie-merge] END stored=${merged.length} (+${added} ~${replaced} -${deleted} skipDead${skippedDead}) names=[${merged.map(c => c.name).join(',')}]`)
}

/** debug 用：cookie 为何被判 dead */
function describeDead(c: any): string {
  if (!c || !c.name) return 'noName'
  if (c.value === '' || c.value == null) return `emptyValue(value=${JSON.stringify(c.value)})`
  if (c.expired === true) return 'expired=true'
  if (c.expires) {
    const t = typeof c.expires === 'string' ? Date.parse(c.expires) : Number(c.expires)
    if (!Number.isNaN(t) && t > 0 && t < Date.now()) return `expires=${c.expires}(past)`
  }
  return 'alive'
}

/**
 * 是否是"死 cookie"——浏览器要从 jar 里删除的：
 *  · expires 已过去（且非 session cookie）
 *  · value 为空字符串
 * 注意 SmartCookie.expired 字段可能由后端 isExpired() getter 序列化进来，
 * 也可能没有；这里同时支持两种。
 */
function isCookieDead(c: any): boolean {
  if (!c || !c.name) return true
  if (c.value === '' || c.value == null) return true
  if (c.expired === true) return true
  if (c.expires) {
    const t = typeof c.expires === 'string' ? Date.parse(c.expires) : Number(c.expires)
    if (!Number.isNaN(t) && t > 0 && t < Date.now()) return true
  }
  return false
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
