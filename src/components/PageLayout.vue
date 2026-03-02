<!--
    页面布局组件
    
    文件：src/components/PageLayout.vue
    
    功能：
    - 包含 AuthMask 和 ErrorOverlay
    - 每个需要认证保护的页面都应该用此组件包裹
    
    使用方式：
    ```vue
    <template>
        <PageLayout>
        <view class="my-page">
            页面内容...
        </view>
        </PageLayout>
    </template>
    ```
-->

<template>
    <view class="page-layout">
        <!-- 页面内容插槽 -->
        <slot />

        <!-- 认证遮罩 -->
        <view v-if="authStore.showMask" class="auth-mask" @touchmove.stop.prevent>
            <view class="mask-backdrop" />
            <view class="mask-content">
                <!-- 加载动画 -->
                <view class="loading-wrapper">
                    <t-loading theme="circular" size="80rpx" />
                </view>

                <!-- 状态文字 -->
                <text class="mask-message">{{ authStore.checkingMessage || '正在验证身份...' }}</text>

                <!-- 阶段指示器 -->
                <view class="phase-indicator">
                    <view v-for="(item, index) in phases" :key="item.key" class="phase-dot" :class="{
                        active: currentPhaseIndex >= index,
                        current: currentPhaseIndex === index
                    }" />
                </view>

                <!-- 提示文字 -->
                <text class="mask-hint">请稍候...</text>
            </view>
        </view>

        <!-- 错误弹窗 -->
        <view v-if="authStore.showErrorOverlay" class="error-overlay" @touchmove.stop.prevent>
            <view class="overlay-backdrop" @click="handleBackdropClick" />
            <view class="overlay-content">
                <!-- 错误图标 -->
                <view class="error-icon" :class="iconClass">
                    <t-icon :name="iconName" size="96rpx" />
                </view>

                <!-- 错误标题 -->
                <text class="error-title">{{ errorTitle }}</text>

                <!-- 错误详情 -->
                <text class="error-message">{{ authStore.error?.message || '发生未知错误' }}</text>

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

                <!-- 错误码（调试用） -->
                <text v-if="showErrorCode" class="error-code">
                    错误码: {{ authStore.error?.code }}
                </text>
            </view>
        </view>
    </view>
</template>

<script setup lang="ts">
/**
 * 页面布局组件
 */
import { ref, computed } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { useAuthGuard } from '@/composables/useAuthGuard'

const authStore = useAuthStore()
const { retry } = useAuthGuard()

// ==================== 遮罩相关 ====================

// 阶段配置
const phases = [
    { key: 'checking-token', label: '验证身份' },
    { key: 'refreshing-token', label: '刷新状态' },
    { key: 'checking-school', label: '检查服务' }
]

// 当前阶段索引
const currentPhaseIndex = computed(() => {
    const phase = authStore.phase
    const index = phases.findIndex(p => p.key === phase)
    return index >= 0 ? index : 0
})

// ==================== 错误弹窗相关 ====================

// 是否正在重试
const retrying = ref(false)

// 是否显示错误码（开发环境显示）
const showErrorCode = computed(() => import.meta.env.DEV)

// 是否可重试
const canRetry = computed(() => authStore.error?.retryable ?? false)

// 错误标题
const errorTitle = computed(() => authStore.getErrorTitle())

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
.page-layout {
    min-height: 100vh;
    position: relative;
}

// ==================== 认证遮罩样式 ====================

.auth-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.mask-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
}

.mask-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60rpx 80rpx;
    background: #ffffff;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
    min-width: 400rpx;
}

.loading-wrapper {
    margin-bottom: 32rpx;
}

.mask-message {
    font-size: 32rpx;
    color: #333333;
    font-weight: 500;
    text-align: center;
    margin-bottom: 24rpx;
}

.phase-indicator {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 24rpx;
}

.phase-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
    background: #e0e0e0;
    transition: all 0.3s ease;

    &.active {
        background: #1976d2;
    }

    &.current {
        width: 24rpx;
        height: 24rpx;
        animation: pulse 1s ease-in-out infinite;
    }
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.2);
        opacity: 0.8;
    }
}

.mask-hint {
    font-size: 24rpx;
    color: #999999;
}

// ==================== 错误弹窗样式 ====================

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