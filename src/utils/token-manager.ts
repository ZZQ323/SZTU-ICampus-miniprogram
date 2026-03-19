/**
 * Token 生命周期管理器（唯一入口）
 *
 * 文件：src/utils/token-manager.ts
 *
 * 职责（且仅此）：
 *   1. ensureToken()   — 保证 token 可用（页面入口调用）
 *   2. refreshToken()  — 刷新过期 token（http.ts 401 时调用）
 *   3. getTokenAge()   — 返回 token 签发至今的毫秒数
 *   4. clearToken()    — 清除本地 token（登出时调用）
 *
 * 设计原则：
 *   - 内部有互斥锁，多处同时调用只跑一次
 *   - 不依赖任何 store、不做 UI、不做导航
 *   - 使用原生 axios 调用 token 端点（避免循环依赖）
 */

import axios from 'axios'
import { createUniAppAxiosAdapter } from '@uni-helper/axios-adapter'
import { getToken, setToken, removeToken } from '@/utils/storage'

// ==================== 配置 ====================

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.3.35:8080'
const TIMEOUT = 15 * 1000

/** token 签发时间存储 key */
const TOKEN_CREATED_KEY = 'icampus_token_created_at'

/** 静默续签阈值：4 小时（毫秒） */
const SILENT_REFRESH_THRESHOLD = 4 * 60 * 60 * 1000

/** 最大可续签窗口：3 天（毫秒）—— 超过则必须重新 initToken */
const MAX_REFRESH_WINDOW = 3 * 24 * 60 * 60 * 1000

// ==================== 内部状态 ====================

/** 互斥锁：ensureToken / refreshToken 同时只跑一个 */
let _pending: Promise<boolean> | null = null

/** 后台续签是否已在跑 */
let _bgRefreshing = false

// ==================== 公开 API ====================

/**
 * 确保 token 可用
 *
 * 调用时机：页面 onShow / App.vue onLaunch
 *
 * 逻辑：
 *   1. 无 token → initToken（阻塞）
 *   2. token 年龄 > 3 天 → initToken（阻塞，旧 token 不可续签）
 *   3. token 年龄 > 4 小时 → 后台静默 refresh（不阻塞，返回 true）
 *   4. token 年龄 < 4 小时 → 直接返回 true
 *
 * @returns true = token 可用；false = 无法获取 token
 */
export async function ensureToken(): Promise<boolean> {
    const token = getToken()

    // 情况 1：无 token
    if (!token) {
        return _withLock(() => _initToken())
    }

    const age = getTokenAge()

    // 情况 2：超过 3 天，必须重新初始化
    if (age > MAX_REFRESH_WINDOW) {
        console.log('[TokenManager] token 超过 3 天，重新初始化')
        return _withLock(() => _initToken())
    }

    // 情况 3：超过 4 小时，后台续签（不阻塞）
    if (age > SILENT_REFRESH_THRESHOLD && !_bgRefreshing) {
        console.log('[TokenManager] token 超过 4h，后台续签')
        _bgRefreshing = true
        _refreshToken().finally(() => { _bgRefreshing = false })
    }

    // 情况 4：token 还新鲜
    return true
}

/**
 * 刷新 token（阻塞）
 *
 * 调用时机：http.ts 收到 401 时
 *
 * @returns true = 刷新成功；false = 失败（调用方应 reject 原请求）
 */
export async function refreshToken(): Promise<boolean> {
    return _withLock(() => _refreshToken())
}

/**
 * 获取 token 年龄（毫秒）
 *
 * 返回 0 表示刚签发或无记录
 */
export function getTokenAge(): number {
    try {
        const created = uni.getStorageSync(TOKEN_CREATED_KEY)
        if (!created) return 0
        return Date.now() - Number(created)
    } catch {
        return 0
    }
}

/**
 * 清除 token（登出 / 重置会话时调用）
 */
export function clearToken(): void {
    removeToken()
    try {
        uni.removeStorageSync(TOKEN_CREATED_KEY)
    } catch { /* ignore */ }
}

/**
 * 是否有本地 token
 */
export function hasLocalToken(): boolean {
    return !!getToken()
}

// ==================== 内部实现 ====================

/**
 * 互斥锁：同一时刻只有一个 token 操作在跑
 * 后续调用等待第一个的结果
 */
async function _withLock(fn: () => Promise<boolean>): Promise<boolean> {
    if (_pending) {
        console.log('[TokenManager] 操作已在进行中，等待结果...')
        return _pending
    }

    _pending = fn().finally(() => { _pending = null })
    return _pending
}

/**
 * 初始化 token：wx.login() → /wx-auth/v1/get-token
 */
async function _initToken(): Promise<boolean> {
    try {
        const loginResult = await uni.login()
        if (!loginResult.code) {
            console.error('[TokenManager] wx.login 失败')
            return false
        }

        const resp = await _rawPost('/wx-auth/v1/get-token', { wxCode: loginResult.code })

        if (resp.data?.data?.token) {
            _saveToken(resp.data.data.token)
            console.log('[TokenManager] initToken 成功')
            return true
        }

        console.error('[TokenManager] initToken 响应无 token')
        return false
    } catch (e: any) {
        console.error('[TokenManager] initToken 失败:', e?.message || e)
        return false
    }
}

/**
 * 刷新 token：wx.login() → /wx-auth/v1/refresh-token（带旧 token）
 */
async function _refreshToken(): Promise<boolean> {
    try {
        const oldToken = getToken()
        if (!oldToken) {
            // 没有旧 token，降级为 init
            return _initToken()
        }

        const loginResult = await uni.login()
        if (!loginResult.code) {
            console.error('[TokenManager] wx.login 失败')
            return false
        }

        const resp = await _rawPost(
            '/wx-auth/v1/refresh-token',
            { wxCode: loginResult.code },
            { 'Authorization': `Bearer ${oldToken}` }
        )

        if (resp.data?.data?.token) {
            _saveToken(resp.data.data.token)
            console.log('[TokenManager] refreshToken 成功')
            return true
        }

        console.warn('[TokenManager] refresh 响应无 token，降级为 init')
        return _initToken()
    } catch (e: any) {
        console.warn('[TokenManager] refreshToken 失败:', e?.message || e)

        // refresh 失败（超过 3 天 / Redis 无数据），尝试 init
        return _initToken()
    }
}

/**
 * 保存 token + 记录签发时间
 */
function _saveToken(token: string): void {
    setToken(token)
    try {
        uni.setStorageSync(TOKEN_CREATED_KEY, String(Date.now()))
    } catch { /* ignore */ }
}

/**
 * 原生 axios POST（不经过 http.ts 拦截器，避免循环依赖）
 */
function _rawPost(url: string, data: any, extraHeaders?: Record<string, string>) {
    return axios.post(
        `${BASE_URL}${url}`,
        data,
        {
            headers: {
                'Content-Type': 'application/json',
                ...extraHeaders,
            },
            adapter: createUniAppAxiosAdapter(),
            timeout: TIMEOUT,
        }
    )
}