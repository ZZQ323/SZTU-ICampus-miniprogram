/**
 * 认证守卫（Cookie 直通版）
 *
 * 文件：src/hooks/useAuthGuard.ts
 *
 * 变更：
 * - 移除 ensureToken()（不再有 JWT）
 * - 检查 hasAuth()（本地是否有 cookies）
 * - 有 → checkSchoolSession
 * - 无 → 跳转登录页
 */

import { ref, readonly } from 'vue'
import { hasAuth } from '@/utils/cookie-manager'
import { useUserStore } from '@/store/modules/user'

// ==================== 类型 ====================

export interface EnsureOptions {
    /** 是否需要学校登录（公告/课表页 = true，首页 = false） */
    requireSchoolLogin?: boolean
    /** 有 cookies 时是否静默检查学校状态 */
    checkIfLoggedIn?: boolean
}

export interface EnsureResult {
    success: boolean
    logined: boolean
    loginTypes?: string[]
    error?: string
}

// ==================== 全局共享状态 ====================

const _isReady = ref(false)
let _lastCheckTime = 0
const CACHE_TTL = 30 * 1000

// ==================== Composable ====================

export function useAuthGuard() {
    const userStore = useUserStore()

    const isReady = readonly(_isReady)

    /**
     * 确保认证状态就绪
     *
     * 页面 onShow 调用：
     *   - 首页：    ensure()                              // 不要求登录
     *   - 课表页：  ensure({ requireSchoolLogin: true })  // 必须学校登录
     *   - 登录页：  不调用 ensure
     */
    async function ensure(options: EnsureOptions = {}): Promise<EnsureResult> {
        const { requireSchoolLogin = false, checkIfLoggedIn = true } = options

        // 缓存命中
        const now = Date.now()
        if (_isReady.value && (now - _lastCheckTime) < CACHE_TTL) {
            if (!requireSchoolLogin || userStore.isSchoolLoggedIn) {
                return { success: true, logined: userStore.isSchoolLoggedIn }
            }
        }

        _isReady.value = false

        // 检查本地是否有认证信息
        const hasLocalAuth = hasAuth()

        if (!hasLocalAuth) {
            // 无认证信息 → 先初始化会话获取 cookies（所有校园服务都需要）
            try {
                const result = await userStore.initSession()

                if (result.logined) {
                    // initSession 发现已登录（之前的会话还有效）
                    _isReady.value = true
                    _lastCheckTime = Date.now()
                    return { success: true, logined: true, loginTypes: result.loginTypes }
                }

                // 未登录，但 cookies 已获取并存储
                _isReady.value = true
                _lastCheckTime = Date.now()

                if (requireSchoolLogin) {
                    goLogin(result.loginTypes)
                    return { success: false, logined: false, loginTypes: result.loginTypes, error: '需要登录学校账号' }
                }
                return { success: true, logined: false, loginTypes: result.loginTypes }

            } catch (e: any) {
                console.warn('[AuthGuard] initSession 失败:', e?.message)
                _isReady.value = true
                _lastCheckTime = Date.now()

                if (requireSchoolLogin) {
                    goLogin()
                    return { success: false, logined: false, error: '初始化失败' }
                }
                return { success: true, logined: false }
            }
        }

        // 有认证信息，检查学校登录状态
        if (requireSchoolLogin || checkIfLoggedIn) {
            try {
                const status = await userStore.checkSchoolSession()

                _lastCheckTime = Date.now()
                _isReady.value = true

                if (requireSchoolLogin && !status.logined) {
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

                if (requireSchoolLogin) {
                    goLogin()
                    return { success: false, logined: false, error: e?.message }
                }

                userStore.clearSchoolSession()
                return { success: true, logined: false }
            }
        }

        _lastCheckTime = Date.now()
        _isReady.value = true
        return { success: true, logined: userStore.isSchoolLoggedIn }
    }

    // ==================== 辅助方法 ====================

    function goLogin(loginTypes?: string[]) {
        const param = (loginTypes || userStore.loginTypes || []).join(',') || 'SMS'
        uni.navigateTo({
            url: `/pages/common/login/login?loginTypes=${param}`,
            fail: () => uni.redirectTo({ url: '/pages/common/login/login' }),
        })
    }

    async function forceCheck(options?: EnsureOptions): Promise<EnsureResult> {
        _lastCheckTime = 0
        return ensure(options)
    }

    function reset() {
        _isReady.value = false
        _lastCheckTime = 0
    }

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
