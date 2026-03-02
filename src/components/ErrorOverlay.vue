<!--
  错误弹窗组件
  
  文件：src/components/ErrorOverlay.vue
  
  功能：
  - 显示认证/网络错误
  - 提供重试按钮（可重试的错误）
  - 提供取消/确定按钮
  
  使用方式：
  在 App.vue 中全局挂载，无需在每个页面引入
-->

<template>
    <view v-if="authStore.showErrorOverlay" class="error-overlay" @touchmove.stop.prevent>
        <view class="overlay-backdrop" @click="handleBackdropClick" />
        <view class="overlay-content">
            <!-- 错误图标 -->
            <view class="error-icon" :class="iconClass">
                <t-icon :name="iconName" size="96rpx" />
            </view>

            <!-- 错误标题 -->
            <text class="error-title">{{ title }}</text>

            <!-- 错误详情 -->
            <text class="error-message">{{ message }}</text>

            <!-- 操作按钮 -->
            <view class="error-actions">
                <!-- 可重试：显示重试+取消 -->
                <template v-if="canRetry">
                    <t-button theme="primary" size="large" :loading="retrying" @click="handleRetry">
                        重试
                    </t-button>
                    <t-button theme="light" size="large" @click="handleCancel">
                        取消
                    </t-button>
                </template>

                <!-- 不可重试：只显示确定 -->
                <template v-else>
                    <t-button theme="primary" size="large" block @click="handleConfirm">
                        {{ confirmText }}
                    </t-button>
                </template>
            </view>

            <!-- 错误码（调试用，可选显示） -->
            <text v-if="showErrorCode" class="error-code">
                错误码: {{ authStore.error?.code }}
            </text>
        </view>
    </view>
</template>

<script setup lang="ts">
/**
 * 错误弹窗组件
 */
import { ref, computed } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { useAuthGuard } from '@/composables/useAuthGuard'

const authStore = useAuthStore()
const { retry } = useAuthGuard()

// 是否正在重试
const retrying = ref(false)

// 是否显示错误码（开发环境显示）
const showErrorCode = computed(() => {
    return import.meta.env.DEV
})

// 是否可重试
const canRetry = computed(() => authStore.error?.retryable ?? false)

// 错误标题
const title = computed(() => authStore.getErrorTitle())

// 错误消息
const message = computed(() => authStore.error?.message || '发生未知错误')

// 确认按钮文字
const confirmText = computed(() => {
    const code = authStore.error?.code
    if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') {
        return '重新登录'
    }
    return '确定'
})

// 图标名称
const iconName = computed(() => {
    const code = authStore.error?.code
    switch (code) {
        case 'NETWORK_ERROR':
        case 'TIMEOUT':
            return 'wifi-off'
        case 'TOKEN_EXPIRED':
        case 'TOKEN_INVALID':
        case 'REFRESH_FAILED':
            return 'lock-on'
        case 'SERVER_ERROR':
            return 'server'
        default:
            return 'error-circle'
    }
})

// 图标样式类
const iconClass = computed(() => {
    const code = authStore.error?.code
    switch (code) {
        case 'NETWORK_ERROR':
        case 'TIMEOUT':
            return 'icon-warning'
        case 'TOKEN_EXPIRED':
        case 'TOKEN_INVALID':
        case 'REFRESH_FAILED':
            return 'icon-auth'
        case 'SERVER_ERROR':
            return 'icon-error'
        default:
            return 'icon-error'
    }
})

// 处理重试
async function handleRetry() {
    retrying.value = true
    try {
        await retry()
    } finally {
        retrying.value = false
    }
}

// 处理取消
function handleCancel() {
    authStore.clearError()
    authStore.setPhase('idle')
}

// 处理确认（不可重试的错误）
function handleConfirm() {
    const code = authStore.error?.code

    // 认证相关错误，跳转登录页
    if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID' || code === 'REFRESH_FAILED') {
        authStore.clearError()
        authStore.setPhase('idle')
        uni.reLaunch({ url: '/pages/common/login/index' })
        return
    }

    // 其他错误，关闭弹窗
    authStore.clearError()
    authStore.setPhase('idle')
}

// 处理点击背景
function handleBackdropClick() {
    // 可重试的错误允许点击背景关闭
    if (canRetry.value) {
        handleCancel()
    }
}
</script>

<style lang="scss" scoped>
.error-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.overlay-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
}

.overlay-content {
    position: relative;
    z-index: 1;
    width: 80%;
    max-width: 600rpx;
    background: #ffffff;
    border-radius: 24rpx;
    padding: 48rpx 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.15);
}

.error-icon {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 32rpx;

    &.icon-error {
        background: rgba(250, 81, 81, 0.1);
        color: #fa5151;
    }

    &.icon-warning {
        background: rgba(255, 170, 0, 0.1);
        color: #ffaa00;
    }

    &.icon-auth {
        background: rgba(25, 118, 210, 0.1);
        color: #1976d2;
    }
}

.error-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #333333;
    text-align: center;
    margin-bottom: 16rpx;
}

.error-message {
    font-size: 28rpx;
    color: #666666;
    text-align: center;
    line-height: 1.5;
    margin-bottom: 40rpx;
    padding: 0 20rpx;
}

.error-actions {
    display: flex;
    gap: 24rpx;
    width: 100%;

    :deep(.t-button) {
        flex: 1;
    }
}

.error-code {
    margin-top: 24rpx;
    font-size: 22rpx;
    color: #bbbbbb;
}
</style>