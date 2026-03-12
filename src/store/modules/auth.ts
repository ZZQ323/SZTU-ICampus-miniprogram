/**
 * 认证流程状态管理（修复版）
 * 
 * 文件：src/store/modules/auth.ts
 * 
 * 职责：
 * - 管理认证检查的阶段状态（phase）
 * - 管理错误状态和重试逻辑
 * - 提供全局的遮罩/弹窗显示状态
 * 
 * 修复内容：
 * - 添加 setShowMask 方法
 * - 添加 setCheckingMessage 方法
 * - 修复 setError 方法签名
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthPhase, AuthError, AuthErrorCode, RetryContext } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
    // ==================== 状态 ====================

    /** 当前认证阶段 */
    const phase = ref<AuthPhase>('idle')

    /** 当前检查的描述信息（用于遮罩显示） */
    const checkingMessage = ref('')

    /** 错误信息 */
    const error = ref<AuthError | null>(null)

    /** 重试上下文 */
    const retryContext = ref<RetryContext | null>(null)

    /** 上一次成功认证的时间戳 */
    const lastAuthTime = ref<number>(0)

    /** 是否强制显示遮罩（手动控制） */
    const _forceShowMask = ref(false)

    // ==================== 计算属性 ====================

    /** 是否需要显示遮罩（检查中的状态 或 手动强制显示） */
    const showMask = computed(() =>
        _forceShowMask.value ||
        ['checking-token', 'refreshing-token', 'checking-school'].includes(phase.value)
    )

    /** 是否显示错误弹窗（可重试的错误） */
    const showErrorOverlay = computed(() =>
        phase.value === 'error' && error.value !== null
    )


    /** 是否处于就绪状态 */
    const isReady = computed(() => phase.value === 'ready')

    /** 是否正在检查中 */
    const isChecking = computed(() => showMask.value)

    /** 是否有错误 */
    const hasError = computed(() => error.value !== null)

    /** 错误是否可重试 */
    const canRetry = computed(() => error.value?.retryable ?? false)

    // ==================== 方法 ====================

    /**
     * 设置认证阶段
     */
    function setPhase(newPhase: AuthPhase, message?: string) {
        phase.value = newPhase
        checkingMessage.value = message || getDefaultMessage(newPhase)

        // 进入就绪状态时，清除错误并记录时间
        if (newPhase === 'ready') {
            error.value = null
            retryContext.value = null
            lastAuthTime.value = Date.now()
            _forceShowMask.value = false
        }

        // 进入空闲状态时，清除消息
        if (newPhase === 'idle') {
            checkingMessage.value = ''
            _forceShowMask.value = false
        }
    }

    /**
     * ⭐ 手动设置遮罩显示状态
     * 
     * 用于登录页等需要手动控制遮罩的场景
     */
    function setShowMask(show: boolean) {
        _forceShowMask.value = show
        if (!show) {
            // 隐藏遮罩时，如果不在检查阶段，重置状态
            if (!['checking-token', 'refreshing-token', 'checking-school'].includes(phase.value)) {
                phase.value = 'idle'
            }
        }
    }

    /**
     * ⭐ 设置检查中的消息
     */
    function setCheckingMessage(message: string) {
        checkingMessage.value = message
    }

    /**
     * 设置错误状态（支持两种调用方式）
     * 
     * 方式1: setError('CODE', 'message', true)
     * 方式2: setError({ code: 'CODE', message: 'message', retryable: true })
     */
    function setError(
        codeOrError: AuthErrorCode | AuthError,
        message?: string,
        retryable: boolean = true,
        raw?: any
    ) {
        if (typeof codeOrError === 'object') {
            // 对象形式
            error.value = {
                ...codeOrError,
                timestamp: codeOrError.timestamp || Date.now()
            }
        } else {
            // 参数形式
            error.value = {
                code: codeOrError,
                message: message || '发生错误',
                retryable,
                timestamp: Date.now(),
                raw
            }
        }
        phase.value = 'error'
        checkingMessage.value = ''
        _forceShowMask.value = false
    }

    /**
     * 清除错误状态
     */
    function clearError() {
        error.value = null
        if (phase.value === 'error') {
            phase.value = 'idle'
        }
    }

    /**
     * 设置重试上下文
     */
    function setRetryContext(context: RetryContext | null) {
        retryContext.value = context
    }

    /**
     * 重置所有状态
     */
    function reset() {
        phase.value = 'idle'
        checkingMessage.value = ''
        error.value = null
        retryContext.value = null
        _forceShowMask.value = false
    }

    /**
     * 获取默认的阶段消息
     */
    function getDefaultMessage(p: AuthPhase): string {
        const messages: Record<AuthPhase, string> = {
            'idle': '',
            'checking-token': '正在验证身份...',
            'refreshing-token': '正在刷新登录状态...',
            'checking-school': '正在检查校园服务状态...',
            'ready': '',
            'need-login': '',
            'error': ''
        }
        return messages[p] || ''
    }

    /**
     * 获取错误的友好标题
     */
    function getErrorTitle(): string {
        if (!error.value) return ''

        const titles: Record<AuthErrorCode, string> = {
            'NO_TOKEN': '需要登录',
            'TOKEN_EXPIRED': '登录已过期',
            'TOKEN_INVALID': '身份验证失败',
            'REFRESH_FAILED': '刷新失败',
            'NETWORK_ERROR': '网络错误',
            'TIMEOUT': '请求超时',
            'SERVER_ERROR': '服务器错误',
            'SCHOOL_SESSION_EXPIRED': '校园服务已断开',
            'UNKNOWN': '发生错误'
        }
        return titles[error.value.code] || '发生错误'
    }

    // ==================== 导出 ====================

    return {
        // 状态
        phase,
        checkingMessage,
        error,
        retryContext,
        lastAuthTime,

        // 计算属性
        showMask,
        showErrorOverlay,
        isReady,
        isChecking,
        hasError,
        canRetry,
        // 方法
        setPhase,
        setShowMask,         // 新增
        setCheckingMessage,  // 新增
        setError,
        clearError,
        setRetryContext,
        reset,
        getErrorTitle
    }
})