/**
 * 认证守卫 Composable（改进版）
 * 
 * 文件：src/hooks/composables/useAuthGuard.ts
 * 
 * 功能：
 * 1. 统一的认证检查逻辑
 * 2. isReady 状态：认证完成后才为 true
 * 3. 自动控制遮罩显示/隐藏
 * 4. 支持等待认证完成的 Promise
 * 
 * 使用方式：
 * ```vue
 * <template>
 *   <PageLayout>
 *     <view v-if="isReady" class="page-content">
 *       <!-- 认证完成后才显示的内容 -->
 *     </view>
 *   </PageLayout>
 * </template>
 * 
 * <script setup>
 * const { ensure, isReady } = useAuthGuard()
 * 
 * onShow(async () => {
 *   await ensure({ requireSchoolLogin: true })
 *   // 认证完成后执行
 *   loadData()
 * })
 * </script>
 * ```
 */

import { ref, readonly, computed } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { useAuthStore } from '@/store/modules/auth'

// ==================== 类型定义 ====================

export interface EnsureOptions {
    /** 是否需要学校登录 */
    requireSchoolLogin?: boolean
    /** 认证失败时是否跳转登录页 */
    redirectOnFail?: boolean
    /** 是否静默检查（不显示遮罩） */
    silent?: boolean
    /** 是否强制检查（忽略缓存） */
    forceCheck?: boolean
}

export interface EnsureResult {
    /** 是否成功 */
    success: boolean
    /** 是否已登录学校 */
    logined: boolean
    /** 支持的登录方式 */
    loginTypes?: string[]
    /** 错误信息 */
    error?: string
}

// ==================== 全局状态 ====================

/** 认证是否就绪（全局共享） */
const _isReady = ref(false)

/** 上次检查时间 */
let _lastCheckTime = 0

/** 检查间隔（毫秒）- 30秒内不重复检查 */
const CHECK_INTERVAL = 30 * 1000

/** 等待就绪的 Promise 队列 */
let _readyPromise: Promise<void> | null = null
let _readyResolve: (() => void) | null = null

// ==================== Composable ====================

export function useAuthGuard() {
    const userStore = useUserStore()
    const authStore = useAuthStore()

    // ==================== 状态 ====================

    /** 认证是否就绪（只读） */
    const isReady = readonly(_isReady)

    /** 是否正在检查中 */
    const isChecking = computed(() => authStore.showMask)

    // ==================== 核心方法 ====================

    /**
     * 确保认证状态
     * 
     * @param options 配置选项
     * @returns 认证结果
     */
    async function ensure(options: EnsureOptions = {}): Promise<EnsureResult> {
        const {
            requireSchoolLogin = false,
            redirectOnFail = false,
            silent = false,
            forceCheck = false
        } = options

        // 1. 检查是否可以跳过（30秒内已检查过）
        const now = Date.now()
        if (!forceCheck && _isReady.value && (now - _lastCheckTime) < CHECK_INTERVAL) {
            // 已就绪且在缓存期内
            if (!requireSchoolLogin || userStore.isSchoolLoggedIn) {
                return {
                    success: true,
                    logined: userStore.isSchoolLoggedIn,
                    loginTypes: userStore.loginTypes
                }
            }
        }

        // 2. 显示遮罩（除非静默模式）
        if (!silent) {
            authStore.setShowMask(true)
            authStore.setCheckingMessage('正在验证身份...')
            authStore.setPhase('checking-token')
        }

        // 3. 标记为未就绪
        _isReady.value = false
        _readyPromise = new Promise(resolve => {
            _readyResolve = resolve
        })

        try {
            // 4. 检查 Token
            if (!userStore.hasToken) {
                if (!silent) {
                    authStore.setCheckingMessage('正在初始化...')
                }

                try {
                    await userStore.initToken()
                } catch (e: any) {
                    console.error('[AuthGuard] Token 初始化失败', e)

                    if (!silent) {
                        authStore.setShowMask(false)
                        authStore.setError('TOKEN_INIT_FAILED', e?.message || '初始化失败', true, e)
                    }

                    return {
                        success: false,
                        logined: false,
                        error: 'Token 初始化失败'
                    }
                }
            }

            // 5. 检查学校登录状态
            if (!silent) {
                authStore.setCheckingMessage('正在检查登录状态...')
                authStore.setPhase('checking-school')
            }

            let status
            try {
                status = await userStore.checkSchoolSession()
            } catch (e: any) {
                console.error('[AuthGuard] 检查登录状态失败', e)

                // 如果是 403，表示 Cookie 过期，不算错误
                if (e?.code !== 403) {
                    if (!silent) {
                        authStore.setShowMask(false)
                        authStore.setError('CHECK_FAILED', e?.message || '检查登录状态失败', true, e)
                    }
                }

                status = { logined: false, loginTypes: ['SMS'] }
            }

            // 6. 更新检查时间
            _lastCheckTime = Date.now()

            // 7. 检查是否满足要求
            if (requireSchoolLogin && !status.logined) {
                if (!silent) {
                    authStore.setShowMask(false)
                }

                if (redirectOnFail) {
                    // 跳转登录页，传递登录方式信息
                    const loginTypesParam = status.loginTypes?.join(',') || 'SMS'
                    uni.navigateTo({
                        url: `/pages/common/login/login?loginTypes=${loginTypesParam}`
                    })
                }

                return {
                    success: false,
                    logined: false,
                    loginTypes: status.loginTypes,
                    error: '需要登录学校账号'
                }
            }

            // 8. 认证成功
            if (!silent) {
                authStore.setShowMask(false)
                authStore.setPhase('idle')
            }

            // 标记为就绪
            _isReady.value = true
            _readyResolve?.()

            return {
                success: true,
                logined: status.logined,
                loginTypes: status.loginTypes
            }

        } catch (e: any) {
            console.error('[AuthGuard] 认证检查异常', e)

            if (!silent) {
                authStore.setShowMask(false)
                authStore.setError('UNKNOWN_ERROR', e?.message || '认证检查失败', true, e)
            }

            return {
                success: false,
                logined: false,
                error: e?.message || '认证检查失败'
            }
        }
    }

    /**
     * 等待认证就绪
     * 
     * @returns Promise，认证完成后 resolve
     */
    async function awaitReady(): Promise<void> {
        if (_isReady.value) {
            return
        }

        if (_readyPromise) {
            return _readyPromise
        }

        // 如果没有进行中的检查，创建一个新的等待
        _readyPromise = new Promise(resolve => {
            _readyResolve = resolve
        })

        return _readyPromise
    }

    /**
     * 重试认证
     */
    async function retry(): Promise<EnsureResult> {
        return ensure({ forceCheck: true })
    }

    /**
     * 重置状态
     */
    function reset() {
        _isReady.value = false
        _lastCheckTime = 0
        _readyPromise = null
        _readyResolve = null
        authStore.setShowMask(false)
        authStore.setPhase('idle')
        authStore.clearError()
    }

    /**
     * 强制标记为就绪（用于特殊场景）
     */
    function markReady() {
        _isReady.value = true
        _lastCheckTime = Date.now()
        _readyResolve?.()
    }

    // ==================== 返回 ====================

    return {
        // 状态
        isReady,
        isChecking,

        // 方法
        ensure,
        awaitReady,
        retry,
        reset,
        markReady
    }
}