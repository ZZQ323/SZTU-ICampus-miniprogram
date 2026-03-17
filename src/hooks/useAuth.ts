/**
 * 认证相关 Hook
 * 
 * 文件：src/hooks/useAuth.ts
 * 
 * 提供：
 * - checkStatus()         静默检查状态（App.vue 保活用）
 * - checkStatusWithUI()   带 UI 反馈的检查（点击头像确认登录状态）
 * - forceRefresh()        强制刷新会话（Cookie 过期时）
 * - goLogin()             跳转登录页
 * - needsRefresh()        检查是否需要刷新（超过 30 分钟）
 */

import { ref } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { useAuthStore } from '@/store/modules/auth'

// ==================== 全局状态 ====================

/** 上次检查时间（全局共享） */
let lastCheckTime = 0

/** 保活间隔：30 分钟（毫秒） */
export const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000

// ==================== 类型定义 ====================

export interface CheckResult {
    success: boolean
    logined: boolean
    loginTypes?: string[]
    error?: string
}

// ==================== Hook ====================

export function useAuth() {
    const userStore = useUserStore()
    const authStore = useAuthStore()

    /** 是否正在检查中 */
    const isChecking = ref(false)

    // ==================== 核心方法 ====================

    /**
     * 静默检查状态（不显示 UI）
     * 
     * 用于：
     * - App.vue 启动时检查
     * - App.vue 30 分钟保活
     * - 后台自动检查
     */
    async function checkStatus(): Promise<CheckResult> {
        // 更新检查时间
        lastCheckTime = Date.now()

        // 如果没有 Token，跳过
        if (!userStore.hasToken) {
            console.log('[useAuth] 无 Token，跳过状态检查')
            return { success: false, logined: false, error: '无 Token' }
        }

        try {
            console.log('[useAuth] 开始静默检查状态...')
            const status = await userStore.checkSchoolSession()
            console.log('[useAuth] 状态检查完成: logined=', status.logined)
            return {
                success: true,
                logined: status.logined,
                loginTypes: status.loginTypes
            }
        } catch (e: any) {
            console.warn('[useAuth] 状态检查失败:', e?.message || e)

            // 如果是 401，尝试刷新 Token
            if (e?.code === 401) {
                try {
                    await userStore.refreshTokenIfNeeded()
                    console.log('[useAuth] Token 刷新成功，重试状态检查')
                    const status = await userStore.checkSchoolSession()
                    return {
                        success: true,
                        logined: status.logined,
                        loginTypes: status.loginTypes
                    }
                } catch (refreshError: any) {
                    console.error('[useAuth] Token 刷新失败:', refreshError)
                    return { success: false, logined: false, error: 'Token 刷新失败' }
                }
            }

            // 如果是 403，表示 Cookie 过期
            if (e?.code === 403) {
                console.log('[useAuth] Cookie 已过期')
                return { success: false, logined: false, error: 'Cookie 已过期' }
            }

            return { success: false, logined: false, error: e?.message || '检查失败' }
        }
    }

    /**
     * 带 UI 反馈的检查（显示遮罩和 Toast）
     * 
     * 用于：
     * - 用户点击头像确认登录状态
     * - 用户手动刷新
     * 
     * @param options.showLoading 是否显示加载遮罩（默认 true）
     * @param options.showResult  是否显示结果 Toast（默认 true）
     */
    async function checkStatusWithUI(options?: {
        showLoading?: boolean
        showResult?: boolean
    }): Promise<CheckResult> {
        const { showLoading = true, showResult = true } = options || {}

        // 防止重复检查
        if (isChecking.value) {
            console.log('[useAuth] 正在检查中，跳过')
            return { success: false, logined: false, error: '正在检查中' }
        }

        isChecking.value = true

        // 显示加载遮罩
        if (showLoading) {
            authStore.setShowMask(true)
            authStore.setCheckingMessage('正在检查登录状态...')
        }

        try {
            const result = await checkStatus()

            // 显示结果
            if (showResult) {
                if (result.logined) {
                    uni.showToast({ title: '已登录', icon: 'success' })
                } else if (result.error === 'Cookie 已过期') {
                    uni.showToast({ title: '登录已过期', icon: 'none' })
                } else if (!result.success) {
                    uni.showToast({ title: '检查失败', icon: 'none' })
                }
            }

            return result
        } finally {
            isChecking.value = false
            if (showLoading) {
                authStore.setShowMask(false)
            }
        }
    }

    /**
     * 强制刷新会话（重新初始化 Cookie）
     * 
     * 用于：
     * - Cookie 过期后重新获取
     * - 用户主动刷新会话
     */
    async function forceRefresh(): Promise<CheckResult> {
        isChecking.value = true
        authStore.setShowMask(true)
        authStore.setCheckingMessage('正在刷新会话...')

        try {
            // 调用 initSession 重新初始化
            const result = await userStore.initSession()

            lastCheckTime = Date.now()

            return {
                success: true,
                logined: result.logined,
                loginTypes: result.loginTypes
            }
        } catch (e: any) {
            console.error('[useAuth] 刷新会话失败:', e)
            return {
                success: false,
                logined: false,
                error: e?.message || '刷新失败'
            }
        } finally {
            isChecking.value = false
            authStore.setShowMask(false)
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 获取上次检查时间
     */
    function getLastCheckTime(): number {
        return lastCheckTime
    }

    /**
     * 更新检查时间（外部调用）
     */
    function updateLastCheckTime(): void {
        lastCheckTime = Date.now()
    }

    /**
     * 检查是否需要刷新（超过 30 分钟）
     */
    function needsRefresh(): boolean {
        return Date.now() - lastCheckTime > KEEP_ALIVE_INTERVAL
    }

    /**
     * 跳转到登录页
     */
    function goLogin(): void {
        const loginTypesParam = userStore.loginTypes?.join(',') || 'SMS'
        uni.navigateTo({
            url: `/pages/common/login/login?loginTypes=${loginTypesParam}`
        })
    }

    // ==================== 返回 ====================

    return {
        // 状态
        isChecking,

        // 核心方法
        checkStatus,
        checkStatusWithUI,
        forceRefresh,

        // 辅助方法
        getLastCheckTime,
        updateLastCheckTime,
        needsRefresh,
        goLogin,

        // 常量
        KEEP_ALIVE_INTERVAL
    }
}