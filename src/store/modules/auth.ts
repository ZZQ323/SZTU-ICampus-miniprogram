/**
 * 认证流程状态管理（Cookie 直通版）
 *
 * 文件：src/store/modules/auth.ts
 *
 * 简化：移除 token 相关阶段和错误码
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthPhase, AuthError, AuthErrorCode, RetryContext } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
    // ==================== 状态 ====================

    const phase = ref<AuthPhase>('idle')
    const checkingMessage = ref('')
    const error = ref<AuthError | null>(null)
    const retryContext = ref<RetryContext | null>(null)
    const lastAuthTime = ref<number>(0)
    const _forceShowMask = ref(false)

    // ==================== 计算属性 ====================

    const showMask = computed(() =>
        _forceShowMask.value ||
        phase.value === 'checking-session'
    )

    const showErrorOverlay = computed(() =>
        phase.value === 'error' && error.value !== null
    )

    const isReady = computed(() => phase.value === 'ready')
    const isChecking = computed(() => showMask.value)
    const hasError = computed(() => error.value !== null)
    const canRetry = computed(() => error.value?.retryable ?? false)

    // ==================== 方法 ====================

    function setPhase(newPhase: AuthPhase, message?: string) {
        phase.value = newPhase
        checkingMessage.value = message || getDefaultMessage(newPhase)

        if (newPhase === 'ready') {
            error.value = null
            retryContext.value = null
            lastAuthTime.value = Date.now()
            _forceShowMask.value = false
        }

        if (newPhase === 'idle') {
            checkingMessage.value = ''
            _forceShowMask.value = false
        }
    }

    function setShowMask(show: boolean) {
        _forceShowMask.value = show
        if (!show) {
            if (phase.value !== 'checking-session') {
                phase.value = 'idle'
            }
        }
    }

    function setCheckingMessage(message: string) {
        checkingMessage.value = message
    }

    function setError(
        codeOrError: AuthErrorCode | AuthError,
        message?: string,
        retryable: boolean = true,
        raw?: any
    ) {
        if (typeof codeOrError === 'object') {
            error.value = {
                ...codeOrError,
                timestamp: codeOrError.timestamp || Date.now()
            }
        } else {
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

    function clearError() {
        error.value = null
        if (phase.value === 'error') {
            phase.value = 'idle'
        }
    }

    function setRetryContext(context: RetryContext | null) {
        retryContext.value = context
    }

    function reset() {
        phase.value = 'idle'
        checkingMessage.value = ''
        error.value = null
        retryContext.value = null
        _forceShowMask.value = false
    }

    function getDefaultMessage(p: AuthPhase): string {
        const messages: Record<AuthPhase, string> = {
            'idle': '',
            'checking-session': '正在检查校园服务状态...',
            'ready': '',
            'need-login': '',
            'error': ''
        }
        return messages[p] || ''
    }

    function getErrorTitle(): string {
        if (!error.value) return ''

        const titles: Record<AuthErrorCode, string> = {
            'NETWORK_ERROR': '网络错误',
            'TIMEOUT': '请求超时',
            'SERVER_ERROR': '服务器错误',
            'SCHOOL_SESSION_EXPIRED': '校园服务已断开',
            'SESSION_INVALID': '会话无效',
            'CHECK_FAILED': '检查失败',
            'UNKNOWN_ERROR': '未知错误',
            'UNKNOWN': '发生错误',
        }
        return titles[error.value.code] || '发生错误'
    }

    // ==================== 导出 ====================

    return {
        phase,
        checkingMessage,
        error,
        retryContext,
        lastAuthTime,

        showMask,
        showErrorOverlay,
        isReady,
        isChecking,
        hasError,
        canRetry,

        setPhase,
        setShowMask,
        setCheckingMessage,
        setError,
        clearError,
        setRetryContext,
        reset,
        getErrorTitle
    }
})
