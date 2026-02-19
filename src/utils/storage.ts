/**
 * 本地存储工具函数
 * 
 * 文件：src/utils/storage.ts
 */

const TOKEN_KEY = 'icampus_token'
const USER_INFO_KEY = 'icampus_user_info'
const HISTORY_IDS_KEY = 'icampus_history_ids'

// ==================== Token ====================

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token: string): void {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function removeToken(): void {
  uni.removeStorageSync(TOKEN_KEY)
}

export function hasToken(): boolean {
  return !!getToken()
}

// ==================== User Info ====================

export function getUserInfo<T = any>(): T | null {
  const data = uni.getStorageSync(USER_INFO_KEY)
  return data ? JSON.parse(data) : null
}

export function setUserInfo(info: any): void {
  uni.setStorageSync(USER_INFO_KEY, JSON.stringify(info))
}

export function removeUserInfo(): void {
  uni.removeStorageSync(USER_INFO_KEY)
}

// ==================== History User IDs ====================

export function getHistoryIds(): string[] {
  const data = uni.getStorageSync(HISTORY_IDS_KEY)
  return data ? JSON.parse(data) : []
}

export function setHistoryIds(ids: string[]): void {
  uni.setStorageSync(HISTORY_IDS_KEY, JSON.stringify(ids))
}

export function addHistoryId(id: string): void {
  const ids = getHistoryIds()
  if (!ids.includes(id)) {
    ids.unshift(id) // 新的放前面
    // 最多保存 5 个
    if (ids.length > 5) ids.pop()
    setHistoryIds(ids)
  }
}

// ==================== 清理 ====================

export function clearAll(): void {
  removeToken()
  removeUserInfo()
  // 保留历史学号
}