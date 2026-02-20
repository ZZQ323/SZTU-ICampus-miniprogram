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
  try {
    const data = uni.getStorageSync(USER_INFO_KEY)
    return data ? JSON.parse(data) : null
  } catch (e) {
    console.warn('[Storage] 解析用户信息失败', e)
    return null
  }
}

export function setUserInfo(info: any): void {
  try {
    uni.setStorageSync(USER_INFO_KEY, JSON.stringify(info))
  } catch (e) {
    console.warn('[Storage] 保存用户信息失败', e)
  }
}

export function removeUserInfo(): void {
  uni.removeStorageSync(USER_INFO_KEY)
}

// ==================== History User IDs ====================

export function getHistoryIds(): string[] {
  try {
    const data = uni.getStorageSync(HISTORY_IDS_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    return []
  }
}

export function setHistoryIds(ids: string[]): void {
  try {
    uni.setStorageSync(HISTORY_IDS_KEY, JSON.stringify(ids))
  } catch (e) {
    console.warn('[Storage] 保存历史学号失败', e)
  }
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

/**
 * 清理所有数据（包括历史学号）
 */
export function clearEverything(): void {
  removeToken()
  removeUserInfo()
  uni.removeStorageSync(HISTORY_IDS_KEY)
}