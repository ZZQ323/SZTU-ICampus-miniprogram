/**
 * 认证守卫（三层分治版）
 *
 * 文件：src/hooks/composables/useAuthGuard.ts
 *
 * 职责（且仅此）：
 *   1. ensure()    — 页面 onShow 时调用，保证认证状态就绪
 *   2. isReady     — 模板 v-if 绑定，认证完成前隐藏页面内容
 *   3. goLogin()   — 跳转登录页
 *
 * 内部流程：
 *   Step 1: TokenManager.ensureToken()（保证 JWT 可用）
 *   Step 2: 如果 requireSchoolLogin → authApi.getStatus()（检查学校登录）
 *   Step 3: 标记 isReady = true
 *
 * 取代的文件：
 *   - 旧 useAuthGuard.ts（过于复杂）
 *   - useAuth.ts（功能重复）
 *   - router.ts（monkey-patch 脆弱）
 */

import { ref, readonly, computed } from 'vue'
import { ensureToken, hasLocalToken } from '@/utils/token-manager'
import { authApi } from '@/api/auth-apis'
import { useUserStore } from '@/store/modules/user'

// ==================== 类型 ====================

export interface EnsureOptions {
    /** 是否需要学校登录（公告/课表页 = true，首页 = false） */
    requireSchoolLogin?: boolean
    /** 不需要登录但有 token 时是否静默检查学校状态 */
    checkIfLoggedIn?: boolean
}

export interface EnsureResult {
    success: boolean
    logined: boolean
    loginTypes?: string[]
    error?: string
}

// ==================== 全局共享状态 ====================

/** 认证是否就绪（模板用 v-if="isReady"） */
const _isReady = ref(false)

/** 上次成功检查的时间戳 */
let _lastCheckTime = 0

/** 缓存有效期：30 秒内不重复检查 */
const CACHE_TTL = 30 * 1000

// ==================== Composable ====================

export function useAuthGuard() {
    const userStore = useUserStore()

    const isReady = readonly(_isReady)

    // ==================== 核心方法 ====================

    /**
     * 确保认证状态就绪
     *
     * 每个页面的 onShow 调用一次：
     *   - 首页：    ensure()                              // 只要 token
     *   - 信息流：  ensure()                              // 只要 token（不要求登录也能看公开频道）
     *   - 课表页：  ensure({ requireSchoolLogin: true })  // 必须学校登录
     *   - 登录页：  不调用 ensure
     */
    async function ensure(options: EnsureOptions = {}): Promise<EnsureResult> {
        const { requireSchoolLogin = false, checkIfLoggedIn = true } = options

        // ===== 缓存命中：30 秒内不重复检查 =====
        const now = Date.now()
        if (_isReady.value && (now - _lastCheckTime) < CACHE_TTL) {
            if (!requireSchoolLogin || userStore.isSchoolLoggedIn) {
                return { success: true, logined: userStore.isSchoolLoggedIn }
            }
            // 需要学校登录但未登录 → 继续检查（可能是从登录页返回）
        }

        // ===== Step 1: 确保 token =====
        _isReady.value = false

        const tokenOk = await ensureToken()
        if (!tokenOk) {
            // token 获取彻底失败（wx.login 都失败了，基本不会发生）
            _isReady.value = true  // 仍然标记就绪，让页面显示"未登录"状态
            return { success: false, logined: false, error: 'Token 初始化失败' }
        }

        // ===== Step 2: 检查学校登录状态 =====
        if (requireSchoolLogin || checkIfLoggedIn) {
            try {
                const status = await userStore.checkSchoolSession()

                _lastCheckTime = Date.now()
                _isReady.value = true

                if (requireSchoolLogin && !status.logined) {
                    // 需要学校登录但未登录 → 跳登录页
                    goLogin(status.loginTypes)
                    return {
                        success: false,
                        logined: false,
                        loginTypes: status.loginTypes,
                        error: '需要登录学校账号',
                    }
                }

                return {
                    success: true,
                    logined: status.logined,
                    loginTypes: status.loginTypes,
                }

            } catch (e: any) {
                console.warn('[AuthGuard] 检查学校状态失败:', e?.message)

                _lastCheckTime = Date.now()
                _isReady.value = true

                // 401 = token 在 Step 1 刚拿到却立刻过期？极端情况，视为未登录
                // 403 = Cookie 过期，视为未登录
                // 其他 = 网络问题，也视为未登录
                if (requireSchoolLogin) {
                    goLogin()
                    return { success: false, logined: false, error: e?.message }
                }

                // 不要求学校登录的页面，忽略错误，显示未登录态
                userStore.clearSchoolSession()
                return { success: true, logined: false }
            }
        }

        // ===== 不需要检查学校状态（纯 token 页面） =====
        _lastCheckTime = Date.now()
        _isReady.value = true
        return { success: true, logined: userStore.isSchoolLoggedIn }
    }

    // ==================== 辅助方法 ====================

    /**
     * 跳转到登录页
     */
    function goLogin(loginTypes?: string[]) {
        const param = (loginTypes || userStore.loginTypes || []).join(',') || 'SMS'
        uni.navigateTo({
            url: `/pages/common/login/login?loginTypes=${param}`,
            fail: () => uni.redirectTo({ url: '/pages/common/login/login' }),
        })
    }

    /**
     * 强制重新检查（忽略缓存）
     */
    async function forceCheck(options?: EnsureOptions): Promise<EnsureResult> {
        _lastCheckTime = 0
        return ensure(options)
    }

    /**
     * 重置状态（登出时调用）
     */
    function reset() {
        _isReady.value = false
        _lastCheckTime = 0
    }

    /**
     * 手动标记就绪（登录成功后从登录页返回时调用）
     */
    function markReady() {
        _isReady.value = true
        _lastCheckTime = Date.now()
    }

    // ==================== 返回 ====================

    return {
        isReady,
        ensure,
        forceCheck,
        goLogin,
        reset,
        markReady,
    }
}