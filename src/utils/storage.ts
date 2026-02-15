/**
 * 本地缓存工具
 * 封装 uni.getStorageSync / uni.setStorageSync
 * 相当于后端的 RedisTemplate
 */

const TOKEN_KEY = 'access_token'

// ===== Token 专用 =====

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function removeToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

// ===== 通用存取 =====

export function getStorage<T = any>(key: string): T | null {
  try {
    const val = uni.getStorageSync(key)
    if (!val) return null
    return typeof val === 'string' ? JSON.parse(val) : val
  } catch {
    return null
  }
}

export function setStorage(key: string, value: any) {
  uni.setStorageSync(key, typeof value === 'string' ? value : JSON.stringify(value))
}

export function clearStorage() {
  uni.clearStorageSync()
}
