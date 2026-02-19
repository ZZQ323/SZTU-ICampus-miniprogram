/**
 * 认证相关 Hook
 * 
 * 文件：src/hooks/useAuth.ts
 * 
 * 封装认证流程的核心逻辑，供页面复用
 */

import { ref, computed } from 'vue'
import { useUserStore } from '@/store/modules/user'
import type { LoginStatusVo, LoginType } from '@/api/types/auth'

/** 认证状态枚举 */
export type AuthState =
    | 'checking'      // 检查中
    | 'no-token'      // 无 token
    | 'need-login'    // 有 token，需要登录学校
    | 'logged-in'     // 已登录学校
    | 'error'         // 出错

/** 认证检查结果 */
export interface AuthCheckResult {
    state: AuthState
    loginTypes?: LoginType[]
    error?: string
}

/**
 * 认证逻辑 Hook
 * 
 * 使用示例：
 * ```ts
 * const { authState, checkAuth, ensureAuth } = useAuth()
 * 
 * onShow(async () => {
 *   const result = await ensureAuth()
 *   if (result.state === 'logged-in') {
 *     // 加载数据
 *   }
 * })
 * ```
 */
export function useAuth() {
    const userStore = useUserStore()

    const authState = ref<AuthState>('checking')
    const lastStatus = ref<LoginStatusVo | null>(null)
    const errorMessage = ref('')

    // 计算属性
    const isLoggedIn = computed(() => authState.value === 'logged-in')
    const isChecking = computed(() => authState.value === 'checking')
    const needLogin = computed(() => authState.value === 'need-login')

    /**
     * 检查认证状态（不做任何跳转）
     */
    async function checkAuth(): Promise<AuthCheckResult> {
        authState.value = 'checking'
        errorMessage.value = ''

        try {
            // 1. 检查 token
            if (!userStore.hasToken) {
                authState.value = 'no-token'
                return { state: 'no-token' }
            }

            // 2. 检查学校登录状态
            const status = await userStore.checkSchoolSession()
            lastStatus.value = status

            if (status.logined) {
                authState.value = 'logged-in'

                // 如果 Cookie 即将过期，后台静默刷新
                if (status.cookieExpiringSoon) {
                    refreshSessionSilently()
                }

                return { state: 'logged-in' }
            } else {
                authState.value = 'need-login'
                return {
                    state: 'need-login',
                    loginTypes: status.loginTypes
                }
            }
        } catch (e: any) {
            authState.value = 'error'
            errorMessage.value = e?.message || '检查登录状态失败'
            return { state: 'error', error: errorMessage.value }
        }
    }

    /**
     * 确保已认证（检查 + 必要时跳转）
     * 
     * @param redirectOnFail 未登录时是否跳转登录页，默认 true
     */
    async function ensureAuth(redirectOnFail = true): Promise<AuthCheckResult> {
        const result = await checkAuth()

        if (redirectOnFail) {
            if (result.state === 'no-token') {
                // 无 token，需要先获取 token
                await initTokenAndRedirect()
                return result
            }

            if (result.state === 'need-login') {
                // 有 token 但未登录学校，跳转登录页
                uni.navigateTo({ url: '/pages/common/login/index' })
                return result
            }
        }

        return result
    }

    /**
     * 初始化 token 并跳转
     */
    async function initTokenAndRedirect() {
        try {
            await userStore.initToken()
            // token 获取成功后，再次检查学校登录状态
            const result = await checkAuth()
            if (result.state === 'need-login') {
                uni.navigateTo({ url: '/pages/common/login/index' })
            }
        } catch (e) {
            authState.value = 'error'
            errorMessage.value = '初始化失败，请重试'
            uni.showToast({ title: '初始化失败', icon: 'error' })
        }
    }

    /**
     * 静默刷新会话（不阻塞用户操作）
     */
    function refreshSessionSilently() {
        userStore.refreshSession()
            .then(() => console.log('会话已静默刷新'))
            .catch(e => console.warn('静默刷新失败', e))
    }

    /**
     * 处理 401 错误（供 HTTP 拦截器调用）
     */
    async function handle401(): Promise<boolean> {
        try {
            // 尝试刷新 token
            const success = await userStore.refreshTokenIfNeeded()
            return success
        } catch (e) {
            // 刷新失败，跳转登录
            userStore.clearAll()
            uni.reLaunch({ url: '/pages/common/login/index' })
            return false
        }
    }

    return {
        // 状态
        authState,
        lastStatus,
        errorMessage,

        // 计算属性
        isLoggedIn,
        isChecking,
        needLogin,

        // 方法
        checkAuth,
        ensureAuth,
        handle401,
        refreshSessionSilently,
    }
}