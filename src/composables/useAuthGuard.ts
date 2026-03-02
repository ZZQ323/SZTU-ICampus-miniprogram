/**
 * 统一认证守卫 Hook
 * 
 * 文件：src/composables/useAuthGuard.ts
 * 
 * 这是整个认证系统的核心入口，页面只需要调用 ensure() 方法
 * 即可完成所有认证检查逻辑。
 * 
 * ⭐ 重要设计：
 * - 任何显示用户信息的页面（包括首页）都需要调用 ensure()
 * - ensure() 总是会检查学校状态来同步用户信息
 * - requireSchoolLogin 只控制"未登录时是否跳转登录页"
 * 
 * 使用示例：
 * ```ts
 * // 首页：检查身份但不强制登录（显示遮罩保护信息）
 * await ensure({ requireSchoolLogin: false })
 * 
 * // 课表页：检查身份且强制登录
 * await ensure({ requireSchoolLogin: true })
 * ```
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

/**
 * 认证守卫 Hook
 */
export function useAuthGuard() {
    const authStore = useAuthStore()
    const userStore = useUserStore()

    // ==================== 计算属性 ====================

    /** 是否认证就绪 */
    const isReady = computed(() => authStore.isReady)

    /** 是否正在检查中 */
    const isChecking = computed(() => authStore.isChecking)

    /** 当前错误 */
    const error = computed(() => authStore.error)

    /** 是否已登录学校 */
    const isSchoolLoggedIn = computed(() => userStore.isSchoolLoggedIn)

    // ==================== 核心方法 ====================

    /**
     * 确保认证就绪（核心方法）
     * 
     * ⭐ 完整流程（无论 requireSchoolLogin 为何值）：
     * 1. 检查本地 Token → 无则获取新 Token
     * 2. 验证 Token 有效性 → 无效则尝试刷新
     * 3. 【总是】检查学校登录状态（同步 userInfo）
     * 4. 如果 requireSchoolLogin=true 且未登录 → 跳转登录页
     *    如果 requireSchoolLogin=false 且未登录 → 清空 userInfo，不跳转
     * 
     * @param options 配置选项
     * @returns 认证结果
     */
    async function ensure(options: EnsureOptions = {}): Promise<EnsureResult> {
        const {
            requireSchoolLogin = true,
            redirectOnFail = true,
            silent = false
        } = options

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
                    // Token 获取失败，清空可能残留的用户信息
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
                // Token 无效，尝试刷新
                if (!silent) {
                    authStore.setPhase('refreshing-token', '正在刷新登录状态...')
                }

                const refreshSuccess = await userStore.refreshTokenIfNeeded()

                if (!refreshSuccess) {
                    // 刷新失败，需要重新获取 Token
                    try {
                        await userStore.initToken()
                    } catch (e: any) {
                        userStore.clearSchoolSession()
                        return handleError('REFRESH_FAILED', '身份验证失败，请重试', true, e)
                    }
                }
            }

            // ========== 第三步：【总是】检查学校登录状态 ==========
            // ⭐ 这是关键改动：无论 requireSchoolLogin 为何值，都要检查
            // 这样才能正确同步 userInfo，保证显示正确的用户信息
            if (!silent) {
                authStore.setPhase('checking-school', '正在检查校园服务状态...')
            }

            let status: LoginStatusVo

            try {
                status = await userStore.checkSchoolSession()
            } catch (e: any) {
                // 检查状态失败，清空用户信息以防显示错误
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
                // ⭐ 未登录时，清空本地可能残留的用户信息
                userStore.clearSchoolSession()

                if (requireSchoolLogin) {
                    // 需要登录：设置状态并跳转
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
                    // 不需要登录：设置为就绪状态，但返回未登录信息
                    authStore.setPhase('ready')
                    return {
                        success: true,  // ⭐ 对于不要求登录的页面，未登录也算成功
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
     * 重试上一次失败的操作
     */
    async function retry(): Promise<EnsureResult> {
        if (!authStore.error) {
            return { success: false, reason: 'ERROR' }
        }

        authStore.clearError()
        return ensure()
    }

    /**
     * 强制刷新认证状态
     * 用于用户手动触发刷新
     */
    async function refresh(): Promise<EnsureResult> {
        authStore.reset()
        return ensure({ silent: false })
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

    /**
     * 验证 Token 有效性
     */
    async function validateToken(): Promise<boolean> {
        try {
            const res = await userStore.checkTokenActive()
            return res === true
        } catch (e) {
            // 401 表示 Token 无效
            if ((e as any)?.code === 401) {
                return false
            }
            // 其他错误暂时认为 Token 有效，让后续请求处理
            return true
        }
    }

    /**
     * 静默刷新会话
     */
    function silentRefreshSession() {
        userStore.refreshSession()
            .then(() => console.log('[AuthGuard] 会话已静默刷新'))
            .catch(e => console.warn('[AuthGuard] 静默刷新失败', e))
    }

    /**
     * 处理错误
     */
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

    /**
     * 等待认证完成
     */
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

            // 超时保护
            setTimeout(() => {
                clearInterval(checkInterval)
                resolve({ success: false, reason: 'ERROR' })
            }, 30000)
        })
    }

    /**
     * 跳转到登录页
     */
    function navigateToLogin() {
        uni.navigateTo({
            url: '/pages/common/login/index',
            fail: () => {
                // 如果 navigateTo 失败（比如已经在登录页），使用 redirectTo
                uni.redirectTo({ url: '/pages/common/login/index' })
            }
        })
    }

    /**
     * 判断是否是网络错误
     */
    function isNetworkError(e: any): boolean {
        return e?.code === 0 || e?.message?.includes('Network Error')
    }

    /**
     * 判断是否是超时错误
     */
    function isTimeoutError(e: any): boolean {
        return e?.code === 504 || e?.code === 408 || e?.message?.includes('timeout')
    }

    // ==================== 导出 ====================

    return {
        // 方法
        ensure,
        retry,
        refresh,
        logout,

        // 计算属性
        isReady,
        isChecking,
        error,
        isSchoolLoggedIn,

        // 直接暴露 store 的一些属性，方便使用
        phase: computed(() => authStore.phase),
        checkingMessage: computed(() => authStore.checkingMessage),
        showMask: computed(() => authStore.showMask),
        showErrorOverlay: computed(() => authStore.showErrorOverlay),
    }
}

// ==================== 导出类型 ====================

export type { EnsureOptions, EnsureResult }