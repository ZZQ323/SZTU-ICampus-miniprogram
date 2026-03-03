/**
 * 统一认证守卫 Hook
 * 
 * 文件：src/composables/useAuthGuard.ts
 * 
 * 这是整个认证系统的核心入口，页面只需要调用 ensure() 方法
 * 即可完成所有认证检查逻辑。
 * 
 * 使用示例：
 * ```ts
 * const { ensure, isReady, isChecking } = useAuthGuard()
 * 
 * onShow(async () => {
 *   const result = await ensure()
 *   if (result.success) {
 *     // 加载业务数据
 *   }
 * })
 * ```
 * ⭐ 优化：添加"短时间内跳过检查"逻辑
 * - 如果用户已登录且最近刚认证过（5秒内），跳过检查
 * - 避免登录成功后返回首页又触发一次 API 请求
 */

import { computed } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { useUserStore } from '@/store/modules/user'
import type {
    EnsureOptions,
    EnsureResult,
    AuthErrorCode,
    LoginStatusVo
} from '@/types/auth'

/** 跳过检查的时间窗口（毫秒） */
const SKIP_CHECK_WINDOW_MS = 5000  // 5秒内跳过重复检查

/**
 * 认证守卫 Hook
 */
export function useAuthGuard() {
    const authStore = useAuthStore()
    const userStore = useUserStore()

    // ==================== 计算属性 ====================

    const isReady = computed(() => authStore.isReady)
    const isChecking = computed(() => authStore.isChecking)
    const error = computed(() => authStore.error)
    const isSchoolLoggedIn = computed(() => userStore.isSchoolLoggedIn)

    // ==================== 核心方法 ====================

    /**
     * 确保认证就绪（核心方法）
     * 
     * ⭐ 优化：如果已登录且最近刚认证过，跳过检查
     */
    async function ensure(options: EnsureOptions = {}): Promise<EnsureResult> {
        const {
            requireSchoolLogin = true,
            redirectOnFail = true,
            silent = false,
            forceCheck = false  // ⭐ 新增：强制检查，忽略跳过逻辑
        } = options

        // ⭐ 优化：短时间内跳过重复检查
        if (!forceCheck && canSkipCheck()) {
            console.log('[AuthGuard] 短时间内已认证，跳过检查')
            
            // 已登录，直接返回成功
            if (userStore.isSchoolLoggedIn) {
                authStore.setPhase('ready')
                return { success: true }
            }
            
            // 未登录但不要求登录，也返回成功
            if (!requireSchoolLogin) {
                authStore.setPhase('ready')
                return { success: true, reason: 'NEED_LOGIN' }
            }
            
            // 未登录且要求登录，跳转登录页
            if (redirectOnFail) {
                navigateToLogin()
            }
            return { success: false, reason: 'NEED_LOGIN' }
        }

        // 如果已经在检查中，等待完成
        if (authStore.isChecking) {
            return waitForAuthComplete()
        }

        try {
            // ========== 第一步：确保有 Token ==========
            if (!userStore.hasToken) {
                if (!silent) {
                    authStore.setPhase('checking-token', '正在初始化...')
                }

                try {
                    await userStore.initToken()
                } catch (e: any) {
                    userStore.clearSchoolSession()
                    return handleError('NO_TOKEN', '初始化失败，请重试', true, e)
                }
            }

            // ========== 第二步：验证 Token 有效性 ==========
            if (!silent) {
                authStore.setPhase('checking-token', '正在验证身份...')
            }

            const tokenValid = await validateToken()

            if (!tokenValid) {
                if (!silent) {
                    authStore.setPhase('refreshing-token', '正在刷新登录状态...')
                }

                const refreshSuccess = await userStore.refreshTokenIfNeeded()

                if (!refreshSuccess) {
                    try {
                        await userStore.initToken()
                    } catch (e: any) {
                        userStore.clearSchoolSession()
                        return handleError('REFRESH_FAILED', '身份验证失败，请重试', true, e)
                    }
                }
            }

            // ========== 第三步：检查学校登录状态 ==========
            if (!silent) {
                authStore.setPhase('checking-school', '正在检查校园服务状态...')
            }

            let status: LoginStatusVo

            try {
                status = await userStore.checkSchoolSession()
            } catch (e: any) {
                userStore.clearSchoolSession()

                if (isNetworkError(e)) {
                    return handleError('NETWORK_ERROR', '网络连接失败，请检查网络', true, e)
                }
                if (isTimeoutError(e)) {
                    return handleError('TIMEOUT', '请求超时，请稍后重试', true, e)
                }
                return handleError('SERVER_ERROR', '服务器错误，请稍后重试', true, e)
            }

            // ========== 第四步：根据登录状态决定后续行为 ==========
            if (!status.logined) {
                userStore.clearSchoolSession()

                if (requireSchoolLogin) {
                    authStore.setPhase('need-login')

                    if (redirectOnFail) {
                        navigateToLogin()
                    }

                    return {
                        success: false,
                        reason: 'NEED_LOGIN',
                        status
                    }
                } else {
                    authStore.setPhase('ready')
                    return {
                        success: true,
                        reason: 'NEED_LOGIN',
                        status
                    }
                }
            }

            // ========== 已登录：Cookie 即将过期时静默刷新 ==========
            if (status.cookieExpiringSoon) {
                silentRefreshSession()
            }

            // ========== 认证成功 ==========
            authStore.setPhase('ready')

            return { success: true, status }

        } catch (e: any) {
            userStore.clearSchoolSession()
            return handleError('UNKNOWN', e.message || '发生未知错误', true, e)
        }
    }

    /**
     * ⭐ 新增：判断是否可以跳过检查
     * 
     * 条件：
     * 1. 最近 5 秒内已经完成过认证
     * 2. 当前状态是 ready 或 idle
     */
    function canSkipCheck(): boolean {
        const now = Date.now()
        const lastAuth = authStore.lastAuthTime
        
        // 如果从未认证过，不能跳过
        if (!lastAuth) return false
        
        // 如果当前有错误，不能跳过
        if (authStore.hasError) return false
        
        // 如果超过时间窗口，不能跳过
        if (now - lastAuth > SKIP_CHECK_WINDOW_MS) return false
        
        // 可以跳过
        return true
    }

    /**
     * 重试上一次失败的操作
     */
    async function retry(): Promise<EnsureResult> {
        if (!authStore.error) {
            return { success: false, reason: 'ERROR' }
        }

        authStore.clearError()
        return ensure({ forceCheck: true })  // ⭐ 重试时强制检查
    }

    /**
     * 强制刷新认证状态
     */
    async function refresh(): Promise<EnsureResult> {
        authStore.reset()
        return ensure({ silent: false, forceCheck: true })  // ⭐ 强制检查
    }

    /**
     * 清除认证状态并跳转登录页
     */
    function logout() {
        userStore.clearAll()
        authStore.reset()
        navigateToLogin()
    }

    // ==================== 内部辅助方法 ====================

    async function validateToken(): Promise<boolean> {
        try {
            const res = await userStore.checkTokenActive()
            return res === true
        } catch (e) {
            if ((e as any)?.code === 401) {
                return false
            }
            return true
        }
    }

    function silentRefreshSession() {
        userStore.refreshSession()
            .then(() => console.log('[AuthGuard] 会话已静默刷新'))
            .catch(e => console.warn('[AuthGuard] 静默刷新失败', e))
    }

    function handleError(
        code: AuthErrorCode,
        message: string,
        retryable: boolean,
        raw?: any
    ): EnsureResult {
        authStore.setError(code, message, retryable, raw)
        return {
            success: false,
            reason: 'ERROR',
            error: authStore.error!
        }
    }

    function waitForAuthComplete(): Promise<EnsureResult> {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!authStore.isChecking) {
                    clearInterval(checkInterval)

                    if (authStore.isReady) {
                        resolve({ success: true })
                    } else if (authStore.error) {
                        resolve({
                            success: false,
                            reason: 'ERROR',
                            error: authStore.error
                        })
                    } else if (authStore.phase === 'need-login') {
                        resolve({ success: false, reason: 'NEED_LOGIN' })
                    } else {
                        resolve({ success: false, reason: 'ERROR' })
                    }
                }
            }, 100)

            setTimeout(() => {
                clearInterval(checkInterval)
                resolve({ success: false, reason: 'ERROR' })
            }, 30000)
        })
    }

    function navigateToLogin() {
        uni.navigateTo({
            url: '/pages/common/login/login',
            fail: () => {
                uni.redirectTo({ url: '/pages/common/login/login' })
            }
        })
    }

    function isNetworkError(e: any): boolean {
        return e?.code === 0 || e?.message?.includes('Network Error')
    }

    function isTimeoutError(e: any): boolean {
        return e?.code === 504 || e?.code === 408 || e?.message?.includes('timeout')
    }

    // ==================== 导出 ====================

    return {
        ensure,
        retry,
        refresh,
        logout,

        isReady,
        isChecking,
        error,
        isSchoolLoggedIn,

        phase: computed(() => authStore.phase),
        checkingMessage: computed(() => authStore.checkingMessage),
        showMask: computed(() => authStore.showMask),
        showErrorOverlay: computed(() => authStore.showErrorOverlay),
    }
}

export type { EnsureOptions, EnsureResult }